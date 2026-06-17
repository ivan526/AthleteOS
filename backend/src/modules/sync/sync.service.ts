import { Injectable, Logger } from '@nestjs/common';
import { resolve } from 'path';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { IntervalsApiService, IntervalsActivity, IntervalsWellness } from './intervals-api.service';
import { GarminApiService, GarminHrvRecord } from './garmin-api.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private intervalsApi: IntervalsApiService,
    private garminApi: GarminApiService,
  ) {}

  /**
   * 同步Intervals.icu数据
   * @param userId 用户ID
   * @param fullSync 是否全量同步
   */
  async syncIntervalsData(userId: string, fullSync: boolean = false): Promise<{
    success: boolean;
    syncedActivities: number;
    syncedWellness?: number;
    newActivities: number;
    updatedActivities: number;
    lastSyncAt?: Date;
    error?: string;
  }> {
    try {
      // 获取用户的Intervals连接信息
      const connectedAccount = await this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'intervals.icu',
          },
        },
      });

      if (!connectedAccount) {
        throw new Error('No Intervals.icu account connected');
      }

      // 更新同步状态为同步中
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          syncStatus: 'syncing',
          syncMessage: '正在同步训练数据...',
        },
      });

      // 确定同步时间范围
      let startDate: Date | undefined;
      if (!fullSync && connectedAccount.lastSyncAt) {
        // 增量同步：从上次同步时间往前多算1天，避免遗漏
        startDate = new Date(connectedAccount.lastSyncAt.getTime() - 24 * 60 * 60 * 1000);
      } else {
        // 全量同步：同步最近180天的数据
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 180);
      }

      const endDate = new Date();

      this.logger.log(`Syncing activities from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // 获取活动数据
      const activities = await this.intervalsApi.getActivities(
        connectedAccount.athleteId,
        connectedAccount.apiKey,
        startDate,
        endDate,
      );
      const wellness = await this.intervalsApi.getWellness(
        connectedAccount.athleteId,
        connectedAccount.apiKey,
        startDate,
        endDate,
      );

      let newCount = 0;
      let updatedCount = 0;

      // 处理每个活动，去重并存储
      for (const activity of activities) {
        const existing = await this.prisma.activity.findUnique({
          where: {
            connectedAccountId_providerActivityId: {
              connectedAccountId: connectedAccount.id,
              providerActivityId: activity.id,
            },
          },
        });
        await this.processActivity(connectedAccount.id, activity);
        if (existing) {
          updatedCount++;
        } else {
          newCount++;
        }
      }

      for (const item of wellness) {
        await this.processWellness(userId, item);
      }

      // 更新同步状态为成功
      const lastSyncAt = new Date();
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          lastSyncAt,
          syncStatus: 'success',
          syncMessage: `同步完成：新增 ${newCount} 条，更新 ${updatedCount} 条训练记录，同步 ${wellness.length} 天健康数据`,
        },
      });

      this.logger.log(`Sync completed: ${newCount} new, ${updatedCount} updated activities`);

      return {
        success: true,
        syncedActivities: activities.length,
        syncedWellness: wellness.length,
        newActivities: newCount,
        updatedActivities: updatedCount,
        lastSyncAt,
      };
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`, error.stack);

      // 更新同步状态为失败
      try {
        const connectedAccount = await this.prisma.connectedAccount.findUnique({
          where: {
            userId_provider: {
              userId,
              provider: 'intervals.icu',
            },
          },
        });
        if (connectedAccount) {
          await this.prisma.connectedAccount.update({
            where: { id: connectedAccount.id },
            data: {
              syncStatus: 'failed',
              syncMessage: `同步失败：${error.message}`,
            },
          });
        }
      } catch (updateError) {
        this.logger.error(`Failed to update sync status: ${updateError.message}`);
      }

      return {
        success: false,
        syncedActivities: 0,
        syncedWellness: 0,
        newActivities: 0,
        updatedActivities: 0,
        error: error.message,
      };
    }
  }

  async syncGarminHrvData(
    userId: string,
    fullSync: boolean = false,
    mfaCode?: string,
  ): Promise<{
    success: boolean;
    fetchedDays: number;
    syncedHrvDays: number;
    skippedExistingHrvDays: number;
    lastSyncAt?: Date;
    error?: string;
  }> {
    const connectedAccount = await this.prisma.connectedAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'garmin.connect',
        },
      },
    });

    if (!connectedAccount || !connectedAccount.apiKey || !connectedAccount.athleteId) {
      return {
        success: false,
        fetchedDays: 0,
        syncedHrvDays: 0,
        skippedExistingHrvDays: 0,
        error: '未配置 Garmin Connect 数据源',
      };
    }

    await this.prisma.connectedAccount.update({
      where: { id: connectedAccount.id },
      data: {
        syncStatus: 'syncing',
        syncMessage: '正在同步 Garmin HRV...',
      },
    });

    try {
      const newest = new Date();
      const oldest = new Date();
      if (!fullSync && connectedAccount.lastSyncAt) {
        oldest.setTime(connectedAccount.lastSyncAt.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        oldest.setDate(oldest.getDate() - 180);
      }

      const result = await this.garminApi.getHrvData({
        email: connectedAccount.athleteId,
        password: connectedAccount.apiKey,
        oldest,
        newest,
        tokenStore: this.getGarminTokenStore(userId),
        mfaCode,
      });

      if (!result.success) {
        throw new Error(result.error ?? result.details ?? 'Garmin HRV 同步失败');
      }

      let syncedHrvDays = 0;
      let skippedExistingHrvDays = 0;
      for (const record of result.records) {
        if (record.hrvScore == null) continue;
        const synced = await this.processGarminHrv(userId, record);
        if (synced) {
          syncedHrvDays++;
        } else {
          skippedExistingHrvDays++;
        }
      }

      const lastSyncAt = new Date();
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          lastSyncAt,
          syncStatus: 'success',
          syncMessage: `同步完成：获取 ${result.fetchedDays} 天，补充 ${syncedHrvDays} 天 HRV`,
        },
      });

      return {
        success: true,
        fetchedDays: result.fetchedDays,
        syncedHrvDays,
        skippedExistingHrvDays,
        lastSyncAt,
      };
    } catch (error) {
      this.logger.error(`Garmin HRV sync failed: ${error.message}`, error.stack);
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          syncStatus: 'failed',
          syncMessage: `Garmin HRV 同步失败：${error.message}`,
        },
      });
      return {
        success: false,
        fetchedDays: 0,
        syncedHrvDays: 0,
        skippedExistingHrvDays: 0,
        error: error.message,
      };
    }
  }

  /**
   * 处理单个活动数据，转换为内部格式并存储
   */
  private async processActivity(connectedAccountId: string, activity: IntervalsActivity): Promise<void> {
    // 转换运动类型
    const sport = this.mapSportType(activity.type);

    // 转换配速（秒/公里）
    let avgPace: number | undefined;
    if (activity.distance && activity.distance > 0 && activity.moving_time > 0) {
      // 距离是米，时间是秒，计算每公里需要的秒数
      avgPace = (activity.moving_time / activity.distance) * 1000;
    }

    const tss = activity.tss ?? activity.icu_training_load ?? activity.hr_load;
    const avgHr = activity.avg_hr ?? activity.average_heartrate;
    const maxHr = activity.max_hr ?? activity.max_heartrate;
    const avgPower = activity.avg_power ?? activity.icu_average_watts;
    const normalizedPower = activity.normalized_power ?? activity.icu_weighted_avg_watts;
    const intensityFactor = activity.intensity_factor ?? (activity.icu_intensity ? activity.icu_intensity / 100 : undefined);

    // 准备数据
    const activityData = {
      connectedAccountId,
      providerActivityId: activity.id,
      sport,
      startTime: activity.start_date,
      durationSeconds: activity.moving_time,
      distanceMeters: activity.distance,
      tss,
      intensityFactor,
      avgHr,
      maxHr,
      avgPower,
      normalizedPower,
      avgPace,
      elevationGain: activity.total_elevation_gain,
      rawData: activity as any,
    };

    // 插入或更新
    await this.prisma.activity.upsert({
      where: {
        connectedAccountId_providerActivityId: {
          connectedAccountId,
          providerActivityId: activity.id,
        },
      },
      update: activityData,
      create: activityData,
    });
  }

  private async processWellness(userId: string, wellness: IntervalsWellness): Promise<void> {
    const date = new Date(`${wellness.id}T00:00:00.000Z`);
    const form = wellness.ctl != null && wellness.atl != null ? wellness.ctl - wellness.atl : null;
    const existing = await this.prisma.dailyAthleteState.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });
    const existingQuality = (existing?.dataQuality as Record<string, unknown> | null) ?? {};
    const existingStateJson = (existing?.stateJson as Record<string, unknown> | null) ?? {};
    const intervalsHrv = wellness.hrv ?? wellness.hrvSDNN ?? null;
    const hasHrv = intervalsHrv != null || Boolean(existingQuality.hasHrv);
    await this.upsertIntervalsWellnessMetric(userId, date, wellness, intervalsHrv);
    const dataQuality = {
      ...existingQuality,
      overall: wellness.sleepScore != null || hasHrv ? 'medium' : 'low',
      source: 'intervals.icu',
      hasSleep: wellness.sleepScore != null || wellness.sleepSecs != null || Boolean(existingQuality.hasSleep),
      hasHrv,
      hrvSource: intervalsHrv != null ? 'intervals.icu' : existingQuality.hrvSource,
      hasCtlAtl: wellness.ctl != null && wellness.atl != null,
    };

    await this.prisma.dailyAthleteState.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        fitness: wellness.ctl ?? undefined,
        fatigue: wellness.atl ?? undefined,
        form: form ?? undefined,
        sleepScore: wellness.sleepScore ?? undefined,
        hrvScore: intervalsHrv ?? undefined,
        subjectiveFatigue: wellness.fatigue != null ? Math.round(wellness.fatigue) : undefined,
        dataQuality: dataQuality as any,
        stateJson: {
          ...existingStateJson,
          intervals: wellness,
          garminHrv: existingStateJson.garminHrv,
        } as any,
      },
      create: {
        userId,
        date,
        dataLevel: 'D',
        dataQuality: dataQuality as any,
        fitness: wellness.ctl ?? null,
        fatigue: wellness.atl ?? null,
        form: form ?? null,
        sleepScore: wellness.sleepScore ?? null,
        hrvScore: intervalsHrv,
        subjectiveFatigue: wellness.fatigue != null ? Math.round(wellness.fatigue) : null,
        trainingCapacity: 50,
        capacityStatus: 'Reduce Intensity',
        trainingRiskScore: 0.3,
        trainingRiskLevel: 'moderate',
        confidence: 0.4,
        stateJson: { intervals: wellness } as any,
      },
    });
  }

  private async upsertIntervalsWellnessMetric(
    userId: string,
    date: Date,
    wellness: IntervalsWellness,
    intervalsHrv: number | null,
  ): Promise<void> {
    await this.prisma.dailyWellnessMetric.upsert({
      where: {
        userId_date_source: {
          userId,
          date,
          source: 'intervals.icu',
        },
      },
      update: {
        sleepScore: wellness.sleepScore ?? undefined,
        sleepSeconds: wellness.sleepSecs != null ? Math.round(wellness.sleepSecs) : undefined,
        sleepQuality: wellness.sleepQuality ?? undefined,
        hrvScore: intervalsHrv ?? undefined,
        hrvMs: wellness.hrv ?? undefined,
        hrvSdnnMs: wellness.hrvSDNN ?? undefined,
        restingHr: wellness.restingHR ?? undefined,
        readiness: wellness.readiness ?? undefined,
        fatigue: wellness.fatigue ?? undefined,
        soreness: wellness.soreness ?? undefined,
        stress: wellness.stress ?? undefined,
        mood: wellness.mood ?? undefined,
        motivation: wellness.motivation ?? undefined,
        weightKg: wellness.weight ?? undefined,
        steps: wellness.steps != null ? Math.round(wellness.steps) : undefined,
        rawData: wellness as any,
      },
      create: {
        userId,
        date,
        source: 'intervals.icu',
        sleepScore: wellness.sleepScore ?? null,
        sleepSeconds: wellness.sleepSecs != null ? Math.round(wellness.sleepSecs) : null,
        sleepQuality: wellness.sleepQuality ?? null,
        hrvScore: intervalsHrv,
        hrvMs: wellness.hrv ?? null,
        hrvSdnnMs: wellness.hrvSDNN ?? null,
        restingHr: wellness.restingHR ?? null,
        readiness: wellness.readiness ?? null,
        fatigue: wellness.fatigue ?? null,
        soreness: wellness.soreness ?? null,
        stress: wellness.stress ?? null,
        mood: wellness.mood ?? null,
        motivation: wellness.motivation ?? null,
        weightKg: wellness.weight ?? null,
        steps: wellness.steps != null ? Math.round(wellness.steps) : null,
        rawData: wellness as any,
      },
    });
  }

  private async processGarminHrv(userId: string, record: GarminHrvRecord): Promise<boolean> {
    const date = new Date(`${record.date}T00:00:00.000Z`);
    const existing = await this.prisma.dailyAthleteState.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });
    const stateJson = (existing?.stateJson as Record<string, unknown> | null) ?? {};
    const dataQuality = (existing?.dataQuality as Record<string, unknown> | null) ?? {};
    const garminHrv = {
      score: record.hrvScore,
      ms: record.hrvMs,
      status: record.status,
      feedbackPhrase: record.feedbackPhrase,
      baseline: record.baseline,
      raw: record.raw,
      syncedAt: new Date().toISOString(),
    };
    await this.upsertGarminWellnessMetric(userId, date, record, garminHrv);

    if (existing) {
      const hasExistingHrv = existing.hrvScore != null;
      await this.prisma.dailyAthleteState.update({
        where: { id: existing.id },
        data: {
          hrvScore: hasExistingHrv ? undefined : record.hrvScore,
          dataQuality: {
            ...dataQuality,
            overall: dataQuality.overall && dataQuality.overall !== 'low' ? dataQuality.overall : 'medium',
            hasHrv: true,
            hrvSource: hasExistingHrv ? dataQuality.hrvSource ?? 'intervals.icu' : 'garmin.connect',
          } as any,
          stateJson: {
            ...stateJson,
            garminHrv,
          } as any,
        },
      });
      return !hasExistingHrv;
    }

    await this.prisma.dailyAthleteState.create({
      data: {
        userId,
        date,
        dataLevel: 'D',
        dataQuality: {
          overall: 'medium',
          source: 'garmin.connect',
          hasSleep: false,
          hasHrv: true,
          hrvSource: 'garmin.connect',
          hasCtlAtl: false,
        } as any,
        hrvScore: record.hrvScore,
        trainingCapacity: 50,
        capacityStatus: 'Reduce Intensity',
        trainingRiskScore: 0.3,
        trainingRiskLevel: 'moderate',
        confidence: 0.4,
        stateJson: { garminHrv } as any,
      },
    });
    return true;
  }

  private async upsertGarminWellnessMetric(
    userId: string,
    date: Date,
    record: GarminHrvRecord,
    garminHrv: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.dailyWellnessMetric.upsert({
      where: {
        userId_date_source: {
          userId,
          date,
          source: 'garmin.connect',
        },
      },
      update: {
        hrvScore: record.hrvScore ?? undefined,
        hrvMs: record.hrvMs ?? undefined,
        rawData: garminHrv as any,
      },
      create: {
        userId,
        date,
        source: 'garmin.connect',
        hrvScore: record.hrvScore ?? null,
        hrvMs: record.hrvMs ?? null,
        rawData: garminHrv as any,
      },
    });
  }

  /**
   * 映射Intervals.icu的运动类型到内部类型
   */
  private mapSportType(intervalsType: string): string {
    const typeMap: Record<string, string> = {
      'Run': 'running',
      'Ride': 'cycling',
      'Swim': 'swimming',
      'WeightTraining': 'strength',
      'Workout': 'strength',
      'Yoga': 'mobility',
      'Walk': 'other',
      'Hike': 'other',
    };

    return typeMap[intervalsType] || 'other';
  }

  /**
   * 测试API连接
   */
  async testConnection(athleteId: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.intervalsApi.getAthlete(athleteId, apiKey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStatus(userId: string) {
    const connectedAccount = await this.prisma.connectedAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'intervals.icu',
        },
      },
      include: {
        _count: {
          select: { activities: true },
        },
        activities: {
          orderBy: { startTime: 'desc' },
          take: 1,
          select: { startTime: true },
        },
      },
    });

    if (!connectedAccount) {
      return {
        connected: false,
        syncStatus: 'not_connected',
        syncMessage: '未连接 Intervals.icu',
        lastSyncAt: null,
        activityCount: 0,
        dailyStateCount: 0,
        latestActivityDate: null,
      };
    }

    const [dailyStateCount, garminAccount] = await Promise.all([
      this.prisma.dailyAthleteState.count({
        where: { userId },
      }),
      this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'garmin.connect',
          },
        },
      }),
    ]);

    return {
      connected: connectedAccount.syncStatus !== 'not_connected',
      syncStatus: connectedAccount.syncStatus,
      syncMessage: connectedAccount.syncMessage,
      lastSyncAt: connectedAccount.lastSyncAt,
      activityCount: connectedAccount._count.activities,
      dailyStateCount,
      latestActivityDate: connectedAccount.activities[0]?.startTime ?? null,
      garmin: {
        connected: Boolean(garminAccount?.apiKey && garminAccount.apiKey !== 'demo'),
        syncStatus: garminAccount?.syncStatus ?? 'not_connected',
        syncMessage: garminAccount?.syncMessage ?? '未配置 Garmin Connect',
        lastSyncAt: garminAccount?.lastSyncAt ?? null,
        email: garminAccount?.athleteId ?? '',
      },
    };
  }

  async getSettings(userId: string) {
    const [profile, connectedAccount, garminAccount, llmSetting] = await Promise.all([
      this.prisma.athleteProfile.findUnique({ where: { userId } }),
      this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'intervals.icu',
          },
        },
      }),
      this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'garmin.connect',
          },
        },
      }),
      this.prisma.llmSetting.findUnique({ where: { userId } }),
    ]);

    return {
      intervals_athlete_id: connectedAccount?.athleteId ?? '',
      has_credentials: Boolean(connectedAccount?.apiKey && connectedAccount.apiKey !== 'demo'),
      last_sync_at: connectedAccount?.lastSyncAt ?? null,
      garmin_email: garminAccount?.athleteId ?? '',
      has_garmin_credentials: Boolean(garminAccount?.apiKey && garminAccount.apiKey !== 'demo'),
      garmin_last_sync_at: garminAccount?.lastSyncAt ?? null,
      garmin_sync_status: garminAccount?.syncStatus ?? 'not_connected',
      garmin_sync_message: garminAccount?.syncMessage ?? '未配置 Garmin Connect',
      llm_provider: llmSetting?.provider ?? 'openai-compatible',
      llm_model: llmSetting?.model ?? '',
      llm_base_url: llmSetting?.baseUrl ?? '',
      llm_enabled: llmSetting?.enabled ?? false,
      has_llm_api_key: Boolean(llmSetting?.apiKey),
      primary_sport: profile?.primarySport ?? 'running',
      weekly_available_days: profile?.weeklyAvailableDays ?? 5,
      preferred_sports: profile?.preferredSports ?? ['running', 'cycling'],
      primary_goal: profile?.primaryGoal ?? '半马 1:40',
      goal_date: profile?.goalDate ?? '2026-11-15',
      goal_time: profile?.goalTime ?? 6000,
    };
  }

  async updateSettings(
    userId: string,
    data: {
      intervals_api_key?: string;
      intervals_athlete_id?: string;
      garmin_email?: string;
      garmin_password?: string;
      llm_provider?: string;
      llm_model?: string;
      llm_base_url?: string;
      llm_api_key?: string;
      llm_enabled?: boolean;
      primary_sport?: string;
      weekly_available_days?: number;
    },
  ) {
    const [existingAccount, existingGarminAccount] = await Promise.all([
      this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'intervals.icu',
          },
        },
      }),
      this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'garmin.connect',
          },
        },
      }),
    ]);

    await this.prisma.athleteProfile.upsert({
      where: { userId },
      update: {
        primarySport: data.primary_sport,
        weeklyAvailableDays: data.weekly_available_days,
      },
      create: {
        userId,
        primarySport: data.primary_sport ?? 'running',
        weeklyAvailableDays: data.weekly_available_days ?? 5,
        preferredSports: ['running', 'cycling'],
      },
    });

    if (data.intervals_api_key || data.intervals_athlete_id) {
      await this.prisma.connectedAccount.upsert({
        where: {
          userId_provider: {
            userId,
            provider: 'intervals.icu',
          },
        },
        update: {
          athleteId: data.intervals_athlete_id ?? existingAccount?.athleteId ?? '',
          apiKey: data.intervals_api_key ?? existingAccount?.apiKey ?? '',
          syncStatus: 'connected',
          syncMessage: '已保存 Intervals.icu 凭证',
        },
        create: {
          userId,
          provider: 'intervals.icu',
          athleteId: data.intervals_athlete_id ?? '',
          apiKey: data.intervals_api_key ?? '',
          syncStatus: 'connected',
          syncMessage: '已保存 Intervals.icu 凭证',
        },
      });
    }

    if (data.garmin_email || data.garmin_password) {
      await this.prisma.connectedAccount.upsert({
        where: {
          userId_provider: {
            userId,
            provider: 'garmin.connect',
          },
        },
        update: {
          athleteId: data.garmin_email ?? existingGarminAccount?.athleteId ?? '',
          apiKey: data.garmin_password ?? existingGarminAccount?.apiKey ?? '',
          syncStatus: 'connected',
          syncMessage: '已保存 Garmin Connect 凭证',
        },
        create: {
          userId,
          provider: 'garmin.connect',
          athleteId: data.garmin_email ?? '',
          apiKey: data.garmin_password ?? '',
          syncStatus: 'connected',
          syncMessage: '已保存 Garmin Connect 凭证',
        },
      });
    }

    if (
      data.llm_provider !== undefined ||
      data.llm_model !== undefined ||
      data.llm_base_url !== undefined ||
      data.llm_api_key !== undefined ||
      data.llm_enabled !== undefined
    ) {
      const existingLlmSetting = await this.prisma.llmSetting.findUnique({ where: { userId } });
      await this.prisma.llmSetting.upsert({
        where: { userId },
        update: {
          provider: data.llm_provider ?? existingLlmSetting?.provider ?? 'openai-compatible',
          model: data.llm_model ?? existingLlmSetting?.model ?? null,
          baseUrl: data.llm_base_url ?? existingLlmSetting?.baseUrl ?? null,
          apiKey: data.llm_api_key ?? existingLlmSetting?.apiKey ?? null,
          enabled: data.llm_enabled ?? existingLlmSetting?.enabled ?? false,
        },
        create: {
          userId,
          provider: data.llm_provider ?? 'openai-compatible',
          model: data.llm_model ?? null,
          baseUrl: data.llm_base_url ?? null,
          apiKey: data.llm_api_key ?? null,
          enabled: data.llm_enabled ?? false,
        },
      });
    }

    return this.getSettings(userId);
  }

  private getGarminTokenStore(userId: string): string {
    return resolve(process.cwd(), '.cache', 'garmin', userId);
  }
}
