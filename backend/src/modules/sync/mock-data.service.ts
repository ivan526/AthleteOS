import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

/**
 * Mock数据生成服务
 * 用于UI开发阶段生成测试数据，不需要真实连接Intervals.icu
 */
@Injectable()
export class MockDataService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成测试用户数据
   */
  async generateTestUser() {
    // 先清理旧数据
    await this.prisma.user.deleteMany({ where: { email: 'test@athleteos.com' } });

    const user = await this.prisma.user.create({
      data: {
        email: 'test@athleteos.com',
        name: '测试用户',
        athleteProfile: {
          create: {
            primarySport: 'running',
            weeklyAvailableDays: 5,
            preferredSports: JSON.stringify(['running', 'cycling']),
            primaryGoal: '半马 1:40',
            goalDate: new Date('2026-11-15'),
            goalTime: 6000, // 1小时40分钟 = 6000秒
          },
        },
        connectedAccounts: {
          create: {
            provider: 'intervals.icu',
            athleteId: 'i212288',
            apiKey: 'test-api-key',
            syncStatus: 'success',
            lastSyncAt: new Date(),
            syncMessage: '同步完成：新增 42 条训练记录',
          },
        },
      },
      include: {
        athleteProfile: true,
        connectedAccounts: true,
      },
    });

    return user;
  }

  /**
   * 生成模拟训练活动数据
   * @param userId 用户ID
   * @param connectedAccountId 连接账户ID
   * @param days 生成多少天的数据
   */
  async generateMockActivities(userId: string, connectedAccountId: string, days: number = 60) {
    const activities: any[] = [];
    const now = new Date();

    // 生成过去60天的训练数据
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // 每周训练5天，休息2天
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // 周末可能休息或长距离
        if (Math.random() > 0.5) continue;
      }

      const activityTypes = [
        { type: 'easy_run', tss: 30, duration: 30 * 60, distance: 5000 },
        { type: 'tempo_run', tss: 65, duration: 50 * 60, distance: 10000 },
        { type: 'interval_run', tss: 80, duration: 60 * 60, distance: 12000 },
        { type: 'long_easy_run', tss: 90, duration: 90 * 60, distance: 18000 },
        { type: 'recovery_run', tss: 20, duration: 25 * 60, distance: 3000 },
      ];

      const randomType = activityTypes[Math.floor(Math.random() * activityTypes.length)];

      const startTime = new Date(date);
      startTime.setHours(7, 0, 0, 0); // 早上7点训练

      const activity = await this.prisma.activity.create({
        data: {
          connectedAccountId,
          providerActivityId: `mock-${i}`,
          sport: 'running',
          startTime,
          durationSeconds: randomType.duration,
          distanceMeters: randomType.distance,
          tss: randomType.tss,
          intensityFactor: 0.7 + Math.random() * 0.3,
          avgHr: 130 + Math.random() * 30,
          maxHr: 160 + Math.random() * 20,
          avgPace: (randomType.duration / randomType.distance) * 1000,
          elevationGain: Math.random() * 100,
          rawData: { mock: true },
        },
      });

      activities.push(activity);
    }

    return activities;
  }

  /**
   * 生成完整的测试数据集
   */
  async generateFullMockData() {
    const user = await this.generateTestUser();
    const connectedAccount = user.connectedAccounts[0];

    await this.generateMockActivities(user.id, connectedAccount.id, 60);

    return {
      userId: user.id,
      connectedAccountId: connectedAccount.id,
      message: 'Mock数据生成完成，包含60天训练记录',
    };
  }
}
