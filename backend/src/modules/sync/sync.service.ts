import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { IntervalsApiService, IntervalsActivity } from './intervals-api.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private intervalsApi: IntervalsApiService,
  ) {}

  /**
   * 同步Intervals.icu数据
   * @param userId 用户ID
   * @param fullSync 是否全量同步
   */
  async syncIntervalsData(userId: string, fullSync: boolean = false): Promise<{
    success: boolean;
    syncedActivities: number;
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

      // 更新同步状态为成功
      const lastSyncAt = new Date();
      await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          lastSyncAt,
          syncStatus: 'success',
          syncMessage: `同步完成：新增 ${newCount} 条，更新 ${updatedCount} 条训练记录`,
        },
      });

      this.logger.log(`Sync completed: ${newCount} new, ${updatedCount} updated activities`);

      return {
        success: true,
        syncedActivities: activities.length,
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
        newActivities: 0,
        updatedActivities: 0,
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

    // 准备数据
    const activityData = {
      connectedAccountId,
      providerActivityId: activity.id,
      sport,
      startTime: activity.start_date,
      durationSeconds: activity.moving_time,
      distanceMeters: activity.distance,
      tss: activity.tss,
      intensityFactor: activity.intensity_factor,
      avgHr: activity.avg_hr,
      maxHr: activity.max_hr,
      avgPower: activity.avg_power,
      normalizedPower: activity.normalized_power,
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

    const dailyStateCount = await this.prisma.dailyAthleteState.count({
      where: { userId },
    });

    return {
      connected: connectedAccount.syncStatus !== 'not_connected',
      syncStatus: connectedAccount.syncStatus,
      syncMessage: connectedAccount.syncMessage,
      lastSyncAt: connectedAccount.lastSyncAt,
      activityCount: connectedAccount._count.activities,
      dailyStateCount,
      latestActivityDate: connectedAccount.activities[0]?.startTime ?? null,
    };
  }

  async getSettings(userId: string) {
    const [profile, connectedAccount] = await Promise.all([
      this.prisma.athleteProfile.findUnique({ where: { userId } }),
      this.prisma.connectedAccount.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'intervals.icu',
          },
        },
      }),
    ]);

    return {
      intervals_athlete_id: connectedAccount?.athleteId ?? '',
      has_credentials: Boolean(connectedAccount?.apiKey && connectedAccount.apiKey !== 'demo'),
      last_sync_at: connectedAccount?.lastSyncAt ?? null,
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
      primary_sport?: string;
      weekly_available_days?: number;
    },
  ) {
    const existingAccount = await this.prisma.connectedAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'intervals.icu',
        },
      },
    });

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

    return this.getSettings(userId);
  }
}
