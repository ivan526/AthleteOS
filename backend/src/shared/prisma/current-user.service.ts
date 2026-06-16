import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

const DEMO_USER_ID = 'b23d32aa-870a-449e-8572-b1fccd8c00e0';

@Injectable()
export class CurrentUserService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getUserId(): Promise<string> {
    const userId = this.config.get<string>('DEMO_USER_ID', DEMO_USER_ID);
    await this.ensureDemoUser(userId);
    return userId;
  }

  private async ensureDemoUser(userId: string) {
    const athleteId = this.config.get<string>('INTERVALS_ATHLETE_ID', 'demo');
    const apiKey = this.config.get<string>('INTERVALS_API_KEY', 'demo');

    const user = await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'demo@athleteos.local',
        name: 'Demo Athlete',
      },
    });

    await this.prisma.athleteProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        primarySport: 'running',
        weeklyAvailableDays: 5,
        preferredSports: ['running', 'cycling'],
        primaryGoal: '半马 1:40',
        goalDate: new Date('2026-11-15T00:00:00.000Z'),
        goalTime: 6000,
      },
    });

    const account = await this.prisma.connectedAccount.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'intervals.icu',
        },
      },
      update: {
        athleteId,
        apiKey,
      },
      create: {
        userId: user.id,
        provider: 'intervals.icu',
        athleteId,
        apiKey,
        syncStatus: apiKey === 'demo' ? 'demo' : 'connected',
        syncMessage: apiKey === 'demo' ? '已创建演示数据' : '已连接 Intervals.icu',
      },
    });

    const activityCount = await this.prisma.activity.count({
      where: { connectedAccountId: account.id },
    });

    if (activityCount === 0) {
      await this.seedActivities(account.id);
    }
  }

  private async seedActivities(connectedAccountId: string) {
    const today = new Date();
    const samples = [
      { daysAgo: 1, title: 'easy-40', tss: 38, duration: 2400, distance: 7800 },
      { daysAgo: 2, title: 'tempo-50', tss: 68, duration: 3000, distance: 10200 },
      { daysAgo: 4, title: 'easy-45', tss: 42, duration: 2700, distance: 8500 },
      { daysAgo: 5, title: 'interval-55', tss: 82, duration: 3300, distance: 9800 },
      { daysAgo: 7, title: 'long-80', tss: 92, duration: 4800, distance: 15000 },
      { daysAgo: 9, title: 'easy-35', tss: 30, duration: 2100, distance: 6500 },
      { daysAgo: 11, title: 'steady-50', tss: 55, duration: 3000, distance: 9600 },
      { daysAgo: 14, title: 'long-75', tss: 86, duration: 4500, distance: 14000 },
      { daysAgo: 17, title: 'tempo-45', tss: 61, duration: 2700, distance: 9000 },
      { daysAgo: 20, title: 'easy-40', tss: 36, duration: 2400, distance: 7600 },
      { daysAgo: 24, title: 'steady-55', tss: 58, duration: 3300, distance: 10400 },
      { daysAgo: 28, title: 'long-70', tss: 78, duration: 4200, distance: 13000 },
      { daysAgo: 35, title: 'tempo-48', tss: 64, duration: 2880, distance: 9400 },
      { daysAgo: 43, title: 'easy-45', tss: 40, duration: 2700, distance: 8300 },
      { daysAgo: 52, title: 'long-85', tss: 96, duration: 5100, distance: 16000 },
      { daysAgo: 63, title: 'steady-50', tss: 56, duration: 3000, distance: 9600 },
    ];

    await this.prisma.activity.createMany({
      data: samples.map((sample) => {
        const startTime = new Date(today);
        startTime.setDate(today.getDate() - sample.daysAgo);
        startTime.setHours(7, 30, 0, 0);

        return {
          connectedAccountId,
          providerActivityId: `demo-${sample.title}-${sample.daysAgo}`,
          sport: 'running',
          startTime,
          durationSeconds: sample.duration,
          distanceMeters: sample.distance,
          tss: sample.tss,
          intensityFactor: sample.tss > 75 ? 0.88 : sample.tss > 55 ? 0.78 : 0.66,
          avgHr: sample.tss > 75 ? 158 : sample.tss > 55 ? 148 : 136,
          maxHr: sample.tss > 75 ? 178 : sample.tss > 55 ? 168 : 154,
          avgPace: sample.duration / (sample.distance / 1000),
          elevationGain: sample.distance / 100,
          rawData: { source: 'demo' },
        };
      }),
    });
  }
}
