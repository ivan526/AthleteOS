import { Injectable, Logger } from '@nestjs/common';
import { resolve } from 'path';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { IntervalsApiService, IntervalsActivity, IntervalsWellness } from './intervals-api.service';
import {
  GarminActivityRecord,
  GarminApiService,
  GarminWellnessRecord,
} from './garmin-api.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly dailySyncs = new Map<string, Promise<DailySyncResult>>();

  constructor(
    private prisma: PrismaService,
    private intervalsApi: IntervalsApiService,
    private garminApi: GarminApiService,
  ) {}

  async syncDailyData(userId: string): Promise<DailySyncResult> {
    const running = this.dailySyncs.get(userId);
    if (running) return running;

    const sync = this.runDailySync(userId).finally(() => {
      this.dailySyncs.delete(userId);
    });
    this.dailySyncs.set(userId, sync);
    return sync;
  }

  private async runDailySync(userId: string): Promise<DailySyncResult> {
    const [intervalsAccount, garminAccount] = await Promise.all([
      this.prisma.connectedAccount.findUnique({
        where: { userId_provider: { userId, provider: 'intervals.icu' } },
      }),
      this.prisma.connectedAccount.findUnique({
        where: { userId_provider: { userId, provider: 'garmin.connect' } },
      }),
    ]);

    const intervalsConfigured = Boolean(
      intervalsAccount?.athleteId &&
      intervalsAccount.apiKey &&
      intervalsAccount.apiKey !== 'demo',
    );
    const garminConfigured = Boolean(
      garminAccount?.athleteId &&
      garminAccount.apiKey &&
      garminAccount.apiKey !== 'demo',
    );
    const intervalsDue =
      intervalsConfigured && !this.isToday(intervalsAccount?.lastSyncAt);
    const garminDue =
      garminConfigured && !this.isToday(garminAccount?.lastSyncAt);

    const garmin = garminDue
      ? await this.syncGarminHrvData(userId, false)
      : null;
    const intervals = intervalsDue
      ? await this.syncIntervalsData(userId, false)
      : null;

    return {
      success: (!intervals || intervals.success) && (!garmin || garmin.success),
      intervals: {
        configured: intervalsConfigured,
        attempted: intervalsDue,
        skipped: !intervalsDue,
        result: intervals,
      },
      garmin: {
        configured: garminConfigured,
        attempted: garminDue,
        skipped: !garminDue,
        result: garmin,
      },
    };
  }

  private isToday(value?: Date | null): boolean {
    if (!value) return false;
    const now = new Date();
    return value.getFullYear() === now.getFullYear()
      && value.getMonth() === now.getMonth()
      && value.getDate() === now.getDate();
  }

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
        const outcome = await this.processIntervalsActivity(
          userId,
          connectedAccount.id,
          activity,
        );
        if (outcome === 'created') {
          newCount++;
        } else {
          updatedCount++;
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
    syncedActivities?: number;
    newActivities?: number;
    mergedActivities?: number;
    syncedWellnessDays?: number;
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
        syncMessage: '正在同步 Garmin 中国区活动与恢复数据...',
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

      const result = await this.garminApi.getData({
        email: connectedAccount.athleteId,
        password: connectedAccount.apiKey,
        oldest,
        newest,
        tokenStore: this.getGarminTokenStore(userId, connectedAccount.authDomain),
        authDomain: connectedAccount.authDomain ?? 'garmin.com',
        mfaCode,
      });

      if (!result.success) {
        throw new Error(result.error ?? result.details ?? 'Garmin 数据同步失败');
      }

      let newActivities = 0;
      let mergedActivities = 0;
      for (const activity of result.activities) {
        const outcome = await this.processGarminActivity(
          userId,
          connectedAccount.id,
          activity,
        );
        if (outcome === 'created') newActivities++;
        else mergedActivities++;
      }

      let syncedHrvDays = 0;
      let skippedExistingHrvDays = 0;
      for (const record of result.wellnessRecords) {
        const synced = await this.processGarminWellness(userId, record);
        if (synced) {
          if (record.hrvScore != null) syncedHrvDays++;
        } else if (record.hrvScore != null) {
          skippedExistingHrvDays++;
        }
      }

      const lastSyncAt = new Date();
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          lastSyncAt,
          syncStatus: 'success',
          syncMessage: `同步完成：${result.activityCount} 条活动，${result.wellnessRecords.length} 天恢复数据，${syncedHrvDays} 天 HRV`,
        },
      });

      return {
        success: true,
        fetchedDays: result.fetchedDays,
        syncedActivities: result.activityCount,
        newActivities,
        mergedActivities,
        syncedWellnessDays: result.wellnessRecords.length,
        syncedHrvDays,
        skippedExistingHrvDays,
        lastSyncAt,
      };
    } catch (error) {
      this.logger.error(`Garmin sync failed: ${error.message}`, error.stack);
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          syncStatus: 'failed',
          syncMessage: `Garmin 数据同步失败：${error.message}`,
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
  private async processIntervalsActivity(
    userId: string,
    connectedAccountId: string,
    activity: IntervalsActivity,
  ): Promise<'created' | 'updated' | 'merged'> {
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

    const exact = await this.prisma.activity.findUnique({
      where: {
        connectedAccountId_providerActivityId: {
          connectedAccountId,
          providerActivityId: activity.id,
        },
      },
    });
    const matched = exact ?? await this.findMatchingActivity(userId, {
      sport,
      startTime: activity.start_date,
      durationSeconds: activity.moving_time,
      distanceMeters: activity.distance,
    });
    const existingRaw = (matched?.rawData as Record<string, any> | null) ?? {};
    const hasGarmin = Boolean(existingRaw.sources?.['garmin.cn']);

    const activityData = {
      sport: hasGarmin ? matched!.sport : sport,
      startTime: hasGarmin ? matched!.startTime : activity.start_date,
      durationSeconds: hasGarmin ? matched!.durationSeconds : activity.moving_time,
      distanceMeters: hasGarmin ? matched!.distanceMeters : activity.distance,
      tss,
      intensityFactor,
      avgHr: hasGarmin ? matched!.avgHr ?? avgHr : avgHr,
      maxHr: hasGarmin ? matched!.maxHr ?? maxHr : maxHr,
      avgPower: hasGarmin ? matched!.avgPower ?? avgPower : avgPower,
      normalizedPower,
      avgPace,
      elevationGain: hasGarmin
        ? matched!.elevationGain ?? activity.total_elevation_gain
        : activity.total_elevation_gain,
      rawData: this.mergeActivityRaw(existingRaw, 'intervals.icu', activity.id, {
        ...activity,
        name: hasGarmin ? existingRaw.name : activity.name ?? existingRaw.name,
        avg_speed: hasGarmin
          ? existingRaw.avg_speed
          : activity.avg_speed ?? activity.average_speed ?? existingRaw.avg_speed,
        max_speed: hasGarmin
          ? existingRaw.max_speed
          : (activity as any).max_speed ?? existingRaw.max_speed,
        average_cadence: hasGarmin
          ? existingRaw.average_cadence
          : activity.average_cadence ?? existingRaw.average_cadence,
        calories: hasGarmin
          ? existingRaw.calories
          : activity.calories ?? existingRaw.calories,
      }) as any,
    };

    if (matched) {
      await this.prisma.activity.update({
        where: { id: matched.id },
        data: activityData,
      });
      return exact ? 'updated' : 'merged';
    }

    await this.prisma.activity.create({
      data: {
        connectedAccountId,
        providerActivityId: activity.id,
        ...activityData,
      },
    });
    return 'created';
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
    const garminRecovery = existingStateJson.garminRecovery as Record<string, unknown> | undefined;
    const hasGarminSleep = garminRecovery?.sleepScore != null || garminRecovery?.sleepSeconds != null;
    const hasGarminHrv = garminRecovery?.score != null;
    const intervalsHrv = wellness.hrv ?? wellness.hrvSDNN ?? null;
    const hasHrv = hasGarminHrv || intervalsHrv != null || Boolean(existingQuality.hasHrv);
    await this.upsertIntervalsWellnessMetric(userId, date, wellness, intervalsHrv);
    const dataQuality = {
      ...existingQuality,
      overall: wellness.sleepScore != null || hasHrv ? 'medium' : 'low',
      source: hasGarminSleep || hasGarminHrv ? 'multi-source' : 'intervals.icu',
      hasSleep: hasGarminSleep || wellness.sleepScore != null || wellness.sleepSecs != null || Boolean(existingQuality.hasSleep),
      hasHrv,
      sleepSource: hasGarminSleep ? 'garmin.cn' : existingQuality.sleepSource ?? 'intervals.icu',
      hrvSource: hasGarminHrv
        ? 'garmin.cn'
        : intervalsHrv != null
          ? 'intervals.icu'
          : existingQuality.hrvSource,
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
        sleepScore: hasGarminSleep ? undefined : wellness.sleepScore ?? undefined,
        hrvScore: hasGarminHrv ? undefined : intervalsHrv ?? undefined,
        subjectiveFatigue: wellness.fatigue != null ? Math.round(wellness.fatigue) : undefined,
        dataQuality: dataQuality as any,
        stateJson: {
          ...existingStateJson,
          intervals: wellness,
          garminRecovery,
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

  private async processGarminActivity(
    userId: string,
    connectedAccountId: string,
    activity: GarminActivityRecord,
  ): Promise<'created' | 'updated' | 'merged'> {
    const sport = this.mapGarminSportType(activity.type);
    const startTime = this.parseGarminStartTime(activity.startTime);
    const durationSeconds = Math.round(activity.durationSeconds ?? 0);
    const distanceMeters = activity.distanceMeters ?? null;
    const exact = await this.prisma.activity.findUnique({
      where: {
        connectedAccountId_providerActivityId: {
          connectedAccountId,
          providerActivityId: activity.id,
        },
      },
    });
    const crossMatch = await this.findMatchingActivity(userId, {
      sport,
      startTime,
      durationSeconds,
      distanceMeters,
    }, exact?.id);
    const matched = exact ?? crossMatch;
    const matchedRaw = (matched?.rawData as Record<string, any> | null) ?? {};
    const crossRaw = (crossMatch?.rawData as Record<string, any> | null) ?? {};
    const existingRaw = exact && crossMatch
      ? {
          ...crossRaw,
          ...matchedRaw,
          sources: {
            ...(crossRaw.sources ?? {}),
            ...(matchedRaw.sources ?? {}),
          },
          providerIds: {
            ...(crossRaw.providerIds ?? {}),
            ...(matchedRaw.providerIds ?? {}),
          },
        }
      : matchedRaw;
    const estimated = this.estimateGarminLoad(activity);
    const intervalsMatch = crossRaw.sources?.['intervals.icu'] ? crossMatch : null;
    const avgPace = sport === 'running' && distanceMeters && durationSeconds
      ? durationSeconds / (distanceMeters / 1000)
      : null;
    const rawData = this.mergeActivityRaw(
      existingRaw,
      'garmin.cn',
      activity.id,
      {
        ...activity.raw,
        name: activity.name ?? existingRaw.name,
        avg_speed: activity.avgSpeed ?? existingRaw.avg_speed,
        max_speed: activity.maxSpeed ?? existingRaw.max_speed,
        average_cadence: activity.avgCadence ?? existingRaw.average_cadence,
        calories: activity.calories ?? existingRaw.calories,
        garmin_training_load: activity.trainingLoad,
        athleteos_load_estimated: activity.tss == null,
      },
    );
    const activityData = {
      sport,
      startTime,
      durationSeconds,
      distanceMeters,
      tss: intervalsMatch?.tss ?? matched?.tss ?? estimated.tss,
      intensityFactor:
        intervalsMatch?.intensityFactor ??
        matched?.intensityFactor ??
        estimated.intensityFactor,
      avgHr: activity.avgHr ?? matched?.avgHr,
      maxHr: activity.maxHr ?? matched?.maxHr,
      avgPower: activity.avgPower ?? matched?.avgPower,
      normalizedPower:
        intervalsMatch?.normalizedPower ??
        matched?.normalizedPower ??
        activity.normalizedPower,
      avgPace,
      elevationGain: activity.elevationGain ?? matched?.elevationGain,
      rawData: rawData as any,
    };

    if (matched) {
      await this.prisma.activity.update({
        where: { id: matched.id },
        data: activityData,
      });
      if (exact && crossMatch && crossMatch.id !== exact.id) {
        await this.prisma.activity.delete({ where: { id: crossMatch.id } });
      }
      return exact ? 'updated' : 'merged';
    }

    await this.prisma.activity.create({
      data: {
        connectedAccountId,
        providerActivityId: activity.id,
        ...activityData,
      },
    });
    return 'created';
  }

  private async processGarminWellness(
    userId: string,
    record: GarminWellnessRecord,
  ): Promise<boolean> {
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
    const garminRecovery = {
      score: record.hrvScore,
      ms: record.hrvMs,
      sleepScore: record.sleepScore,
      sleepSeconds: record.sleepSeconds,
      sleepQuality: record.sleepQuality,
      restingHr: record.restingHr,
      readiness: record.readiness,
      status: record.status,
      feedbackPhrase: record.feedbackPhrase,
      baseline: record.baseline,
      raw: record.raw,
      syncedAt: new Date().toISOString(),
    };
    await this.upsertGarminWellnessMetric(userId, date, record, garminRecovery);

    if (existing) {
      const hasExistingHrv = existing.hrvScore != null;
      await this.prisma.dailyAthleteState.update({
        where: { id: existing.id },
        data: {
          sleepScore: record.sleepScore ?? existing.sleepScore,
          hrvScore: record.hrvScore ?? existing.hrvScore,
          dataQuality: {
            ...dataQuality,
            overall: dataQuality.overall && dataQuality.overall !== 'low' ? dataQuality.overall : 'medium',
            source: 'garmin.cn',
            hasSleep: record.sleepScore != null || record.sleepSeconds != null || Boolean(dataQuality.hasSleep),
            hasHrv: record.hrvScore != null || hasExistingHrv,
            sleepSource: record.sleepScore != null || record.sleepSeconds != null
              ? 'garmin.cn'
              : dataQuality.sleepSource,
            hrvSource: record.hrvScore != null ? 'garmin.cn' : dataQuality.hrvSource,
          } as any,
          stateJson: {
            ...stateJson,
            garminRecovery,
          } as any,
        },
      });
      return record.hrvScore != null ? !hasExistingHrv : true;
    }

    await this.prisma.dailyAthleteState.create({
      data: {
        userId,
        date,
        dataLevel: 'D',
        dataQuality: {
          overall: 'medium',
          source: 'garmin.cn',
          hasSleep: record.sleepScore != null || record.sleepSeconds != null,
          hasHrv: record.hrvScore != null,
          sleepSource: record.sleepScore != null || record.sleepSeconds != null
            ? 'garmin.cn'
            : undefined,
          hrvSource: record.hrvScore != null ? 'garmin.cn' : undefined,
          hasCtlAtl: false,
        } as any,
        sleepScore: record.sleepScore ?? null,
        hrvScore: record.hrvScore,
        trainingCapacity: 50,
        capacityStatus: 'Reduce Intensity',
        trainingRiskScore: 0.3,
        trainingRiskLevel: 'moderate',
        confidence: 0.4,
        stateJson: { garminRecovery } as any,
      },
    });
    return true;
  }

  private async upsertGarminWellnessMetric(
    userId: string,
    date: Date,
    record: GarminWellnessRecord,
    garminRecovery: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.dailyWellnessMetric.upsert({
      where: {
        userId_date_source: {
          userId,
          date,
          source: 'garmin.cn',
        },
      },
      update: {
        sleepScore: record.sleepScore ?? undefined,
        sleepSeconds: record.sleepSeconds != null ? Math.round(record.sleepSeconds) : undefined,
        sleepQuality: record.sleepQuality ?? undefined,
        hrvScore: record.hrvScore ?? undefined,
        hrvMs: record.hrvMs ?? undefined,
        restingHr: record.restingHr ?? undefined,
        readiness: record.readiness ?? undefined,
        rawData: garminRecovery as any,
      },
      create: {
        userId,
        date,
        source: 'garmin.cn',
        sleepScore: record.sleepScore ?? null,
        sleepSeconds: record.sleepSeconds != null ? Math.round(record.sleepSeconds) : null,
        sleepQuality: record.sleepQuality ?? null,
        hrvScore: record.hrvScore ?? null,
        hrvMs: record.hrvMs ?? null,
        restingHr: record.restingHr ?? null,
        readiness: record.readiness ?? null,
        rawData: garminRecovery as any,
      },
    });
  }

  private async findMatchingActivity(
    userId: string,
    activity: {
      sport: string;
      startTime: Date;
      durationSeconds: number;
      distanceMeters?: number | null;
    },
    excludeId?: string,
  ) {
    const toleranceMs = 10 * 60 * 1000;
    const candidates = await this.prisma.activity.findMany({
      where: {
        connectedAccount: { userId },
        sport: activity.sport,
        startTime: {
          gte: new Date(activity.startTime.getTime() - toleranceMs),
          lte: new Date(activity.startTime.getTime() + toleranceMs),
        },
      },
    });

    return candidates.find(
      (candidate) =>
        candidate.id !== excludeId &&
        this.activitiesMatch(candidate, activity),
    );
  }

  private activitiesMatch(
    candidate: {
      sport: string;
      startTime: Date;
      durationSeconds: number;
      distanceMeters?: number | null;
    },
    activity: {
      sport: string;
      startTime: Date;
      durationSeconds: number;
      distanceMeters?: number | null;
    },
  ): boolean {
    if (candidate.sport !== activity.sport) return false;
    const startDifference = Math.abs(
      candidate.startTime.getTime() - activity.startTime.getTime(),
    );
    if (startDifference > 10 * 60 * 1000) {
      return false;
    }
    const durationBase = Math.max(
      candidate.durationSeconds,
      activity.durationSeconds,
      1,
    );
    const durationDifference =
      Math.abs(candidate.durationSeconds - activity.durationSeconds) / durationBase;
    if (!candidate.distanceMeters || !activity.distanceMeters) {
      return durationDifference <= 0.1;
    }
    const distanceBase = Math.max(candidate.distanceMeters, activity.distanceMeters, 1);
    const distanceDifference =
      Math.abs(candidate.distanceMeters - activity.distanceMeters) / distanceBase;
    return distanceDifference <= 0.05
      && (durationDifference <= 0.2 || startDifference <= 2 * 60 * 1000);
  }

  private mergeActivityRaw(
    existing: Record<string, any>,
    source: string,
    providerId: string,
    payload: Record<string, any>,
  ): Record<string, any> {
    return {
      ...existing,
      ...payload,
      sources: {
        ...(existing.sources ?? {}),
        [source]: payload,
      },
      providerIds: {
        ...(existing.providerIds ?? {}),
        [source]: providerId,
      },
    };
  }

  private estimateGarminLoad(activity: GarminActivityRecord): {
    tss: number;
    intensityFactor: number;
  } {
    const durationHours = Math.max(activity.durationSeconds ?? 0, 60) / 3600;
    const trainingEffect = Math.max(
      activity.aerobicTrainingEffect ?? 0,
      activity.anaerobicTrainingEffect ?? 0,
    );
    const intensityFactor = Math.min(0.95, Math.max(0.5, 0.5 + trainingEffect * 0.1));
    return {
      tss: Math.round(activity.tss ?? durationHours * intensityFactor * intensityFactor * 100),
      intensityFactor,
    };
  }

  private parseGarminStartTime(value: string | number): Date {
    if (typeof value === 'number') return new Date(value);
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    return new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  }

  private mapGarminSportType(value?: string): string {
    const type = (value ?? '').toLowerCase();
    if (type.includes('run')) return 'running';
    if (type.includes('cycl') || type.includes('bike') || type.includes('ride')) return 'cycling';
    if (type.includes('swim')) return 'swimming';
    if (type.includes('strength') || type.includes('weight')) return 'strength';
    if (type.includes('yoga') || type.includes('mobility')) return 'mobility';
    return 'other';
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
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { userId },
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
    const connectedAccount = accounts.find((account) => account.provider === 'intervals.icu');
    const garminAccount = accounts.find((account) => account.provider === 'garmin.connect');
    const configuredAccounts = accounts.filter(
      (account) => account.apiKey && account.apiKey !== 'demo',
    );
    const activityCount = accounts.reduce(
      (sum, account) => sum + account._count.activities,
      0,
    );
    const latestActivityDate = accounts
      .map((account) => account.activities[0]?.startTime)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    if (configuredAccounts.length === 0) {
      return {
        connected: false,
        syncStatus: 'not_connected',
        syncMessage: '未连接训练数据源',
        lastSyncAt: null,
        activityCount,
        dailyStateCount: 0,
        latestActivityDate,
      };
    }

    const dailyStateCount = await this.prisma.dailyAthleteState.count({
      where: { userId },
    });
    const primaryAccount = garminAccount?.authDomain === 'garmin.cn'
      ? garminAccount
      : connectedAccount ?? garminAccount ?? configuredAccounts[0];

    return {
      connected: true,
      syncStatus: primaryAccount.syncStatus,
      syncMessage: primaryAccount.syncMessage,
      lastSyncAt: primaryAccount.lastSyncAt,
      activityCount,
      dailyStateCount,
      latestActivityDate,
      primarySource: garminAccount?.authDomain === 'garmin.cn'
        ? 'garmin.cn'
        : 'intervals.icu',
      intervals: {
        connected: Boolean(connectedAccount?.apiKey && connectedAccount.apiKey !== 'demo'),
        syncStatus: connectedAccount?.syncStatus ?? 'not_connected',
        syncMessage: connectedAccount?.syncMessage ?? '未配置 Intervals.icu',
        lastSyncAt: connectedAccount?.lastSyncAt ?? null,
      },
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
      garmin_auth_domain: garminAccount?.authDomain ?? 'garmin.com',
      has_garmin_credentials: Boolean(garminAccount?.apiKey && garminAccount.apiKey !== 'demo'),
      garmin_last_sync_at: garminAccount?.lastSyncAt ?? null,
      garmin_sync_status: garminAccount?.syncStatus ?? 'not_connected',
      garmin_sync_message: garminAccount?.syncMessage ?? '未配置 Garmin Connect',
      primary_data_source: garminAccount?.authDomain === 'garmin.cn'
        && garminAccount?.apiKey
        && garminAccount.apiKey !== 'demo'
        ? 'garmin.cn'
        : 'intervals.icu',
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
      garmin_auth_domain?: string;
      llm_provider?: string;
      llm_model?: string;
      llm_base_url?: string;
      llm_api_key?: string;
      llm_enabled?: boolean;
      primary_sport?: string;
      weekly_available_days?: number;
      preferred_sports?: string[];
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
        preferredSports: data.preferred_sports,
      },
      create: {
        userId,
        primarySport: data.primary_sport ?? 'running',
        weeklyAvailableDays: data.weekly_available_days ?? 5,
        preferredSports: data.preferred_sports ?? ['running', 'cycling'],
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

    if (data.garmin_email || data.garmin_password || data.garmin_auth_domain) {
      const garminAuthDomain = data.garmin_auth_domain === 'garmin.cn' ? 'garmin.cn' : 'garmin.com';
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
          authDomain: garminAuthDomain,
          syncStatus: 'connected',
          syncMessage: '已保存 Garmin Connect 凭证',
        },
        create: {
          userId,
          provider: 'garmin.connect',
          athleteId: data.garmin_email ?? '',
          apiKey: data.garmin_password ?? '',
          authDomain: garminAuthDomain,
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

  private getGarminTokenStore(userId: string, authDomain?: string | null): string {
    const region = authDomain === 'garmin.cn' ? 'cn' : 'global';
    return resolve(process.cwd(), '.cache', 'garmin', region, userId);
  }
}

export interface DailySyncSourceResult {
  configured: boolean;
  attempted: boolean;
  skipped: boolean;
  result: unknown | null;
}

export interface DailySyncResult {
  success: boolean;
  intervals: DailySyncSourceResult;
  garmin: DailySyncSourceResult;
}
