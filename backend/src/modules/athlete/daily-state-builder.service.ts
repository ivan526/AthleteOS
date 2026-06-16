import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Activity } from '@prisma/client';
import { AcwrEngineService } from './acwr-engine.service';
import { MonotonyEngineService } from './monotony-engine.service';
import { TrainingRiskEngineService } from './training-risk-engine.service';
import { TrainingCapacityEngineService } from './training-capacity-engine.service';
import { HardSafetyRulesService } from './hard-safety-rules.service';
import { DataLevel, DailyAthleteState, DataQualityDetail } from './types';

/**
 * Daily Athlete State 构建服务
 * 实现PRD第7节要求
 * 整合所有计算引擎，生成每日运动员状态
 */
@Injectable()
export class DailyStateBuilderService {
  private readonly logger = new Logger(DailyStateBuilderService.name);

  constructor(
    private prisma: PrismaService,
    private acwrEngine: AcwrEngineService,
    private monotonyEngine: MonotonyEngineService,
    private trainingRiskEngine: TrainingRiskEngineService,
    private trainingCapacityEngine: TrainingCapacityEngineService,
    private hardSafetyRules: HardSafetyRulesService,
  ) {}

  /**
   * 构建用户的每日状态
   */
  async buildDailyState(
    userId: string,
    date: Date = new Date(),
  ): Promise<DailyAthleteState> {
    // 获取用户信息和连接账户
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        connectedAccounts: {
          where: { provider: 'intervals.icu' },
          include: {
            activities: {
              where: {
                startTime: {
                  gte: new Date(date.getTime() - 90 * 24 * 60 * 60 * 1000), // 过去90天数据
                },
              },
              orderBy: { startTime: 'desc' },
            },
          },
        },
      },
    });

    if (!user || user.connectedAccounts.length === 0) {
      throw new Error('用户未连接Intervals.icu账户');
    }

    const connectedAccount = user.connectedAccounts[0];
    const activities = connectedAccount.activities;

    // 1. 计算Data Level
    const dataLevel = this.calculateDataLevel(activities);
    this.logger.log(`Data Level for user ${userId}: ${dataLevel}`);

    // 2. 计算数据质量
    const dataQuality = this.calculateDataQuality(activities);

    // 3. 计算CTL/ATL/Form
    const { fitness, fatigue, form } = this.calculateFitnessFatigueForm(activities, date);

    // 4. 计算ACWR
    const acwr = this.acwrEngine.calculate(activities, date);

    // 5. 计算Monotony
    const monotony = this.monotonyEngine.calculate(activities, date);

    // 6. 计算训练风险
    const trainingRisk = this.trainingRiskEngine.calculate({
      acwr,
      monotony,
      form,
      // TODO: 添加睡眠和HRV数据
    });

    // 7. 计算训练能力
    const trainingCapacity = this.trainingCapacityEngine.calculate({
      form,
      acwr,
      monotony,
      dataLevel,
      // TODO: 添加睡眠、HRV、主观疲劳等数据
    });

    // 8. 检查硬性安全规则
    const hardSafety = this.hardSafetyRules.checkRules({
      trainingCapacity,
      trainingRisk,
      acwr,
      form,
      // TODO: 添加连续训练天数、睡眠HRV趋势等数据
    });

    // 9. 计算整体置信度
    const confidence = this.calculateOverallConfidence([
      acwr.confidence,
      monotony.confidence,
      trainingRisk.confidence,
      trainingCapacity.confidence,
    ]);

    // 10. 保存到数据库
    await this.saveDailyState(userId, date, {
      dataLevel,
      dataQuality,
      fitness,
      fatigue,
      form,
      acwr,
      monotony,
      trainingCapacity,
      trainingRisk,
      hardSafety,
      confidence,
    });

    return {
      userId,
      date,
      dataLevel,
      dataQuality,
      fitness,
      fatigue,
      form,
      acwr,
      monotony,
      trainingCapacity,
      trainingRisk,
      hardSafety,
      confidence,
    };
  }

  /**
   * 计算Data Level
   * 参考PRD第1364-1367行
   */
  private calculateDataLevel(activities: Activity[]): DataLevel {
    if (activities.length === 0) return 'D';

    // 计算最早活动日期
    const earliestActivity = activities.reduce(
      (earliest, activity) =>
        activity.startTime < earliest ? activity.startTime : earliest,
      activities[0].startTime,
    );

    const historyDays = Math.ceil(
      (new Date().getTime() - earliestActivity.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (historyDays < 14) return 'D';
    if (historyDays < 42) return 'C';
    if (historyDays < 90) return 'B';
    return 'A';
  }

  /**
   * 计算数据质量
   */
  private calculateDataQuality(activities: Activity[]): DataQualityDetail {
    const historyDays = activities.length
      ? Math.ceil(
          (new Date().getTime() -
            Math.min(...activities.map(a => a.startTime.getTime()))) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    const activityCount = activities.length;
    const tssCount = activities.filter(a => a.tss != null).length;

    let overall: DataQualityDetail['overall'];

    if (historyDays >= 90 && activityCount >= 60 && tssCount / activityCount >= 0.9) {
      overall = 'high';
    } else if (historyDays >= 42 && activityCount >= 30 && tssCount / activityCount >= 0.7) {
      overall = 'medium';
    } else if (historyDays >= 14 && activityCount >= 10) {
      overall = 'low';
    } else {
      overall = 'insufficient';
    }

    return {
      overall,
      historyDays,
      activityCount,
    };
  }

  /**
   * 计算CTL (fitness)、ATL (fatigue)、Form
   * CTL = 过去42天TSS的指数移动平均 (半衰期42天)
   * ATL = 过去7天TSS的指数移动平均 (半衰期7天)
   * Form = CTL - ATL
   */
  private calculateFitnessFatigueForm(activities: Activity[], referenceDate: Date) {
    // 按日期分组每日TSS
    const dailyTss: Record<string, number> = {};

    // 初始化过去42天的日期
    for (let i = 0; i < 42; i++) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyTss[dateStr] = 0;
    }

    // 填充实际TSS数据
    for (const activity of activities) {
      const dateStr = activity.startTime.toISOString().split('T')[0];
      if (dailyTss[dateStr] !== undefined) {
        dailyTss[dateStr] += activity.tss || 0;
      }
    }

    // 按日期排序（从旧到新）
    const sortedDates = Object.keys(dailyTss).sort();
    const tssValues = sortedDates.map(date => dailyTss[date]);

    // 计算CTL (半衰期42天)
    const ctl = this.calculateExponentialMovingAverage(tssValues, 42);

    // 计算ATL (半衰期7天，取最近7天数据)
    const atl = this.calculateExponentialMovingAverage(tssValues.slice(-7), 7);

    const form = ctl - atl;

    return {
      fitness: Number(ctl.toFixed(1)),
      fatigue: Number(atl.toFixed(1)),
      form: Number(form.toFixed(1)),
    };
  }

  /**
   * 计算指数移动平均
   */
  private calculateExponentialMovingAverage(values: number[], days: number): number {
    if (values.length === 0) return 0;

    const alpha = 2 / (days + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }

    return ema;
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(confidences: number[]): number {
    // 去掉最低分，取平均
    const sorted = [...confidences].sort((a, b) => a - b);
    const filtered = sorted.slice(1); // 去掉最低分
    const average = filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
    return Number(average.toFixed(2));
  }

  /**
   * 保存每日状态到数据库
   */
  private async saveDailyState(
    userId: string,
    date: Date,
    state: Omit<DailyAthleteState, 'userId' | 'date'>,
  ) {
    const dateOnly = new Date(date.toISOString().split('T')[0]);

    await this.prisma.dailyAthleteState.upsert({
      where: {
        userId_date: {
          userId,
          date: dateOnly,
        },
      },
      update: {
        dataLevel: state.dataLevel,
        dataQuality: state.dataQuality as any,
        fitness: state.fitness,
        fatigue: state.fatigue,
        form: state.form,
        acwr: state.acwr?.acwr ?? null,
        monotony: state.monotony?.monotony ?? null,
        trainingCapacity: state.trainingCapacity.score,
        capacityStatus: state.trainingCapacity.status,
        trainingRiskScore: state.trainingRisk.score,
        trainingRiskLevel: state.trainingRisk.level,
        confidence: state.confidence,
        stateJson: state as any,
      },
      create: {
        userId,
        date: dateOnly,
        dataLevel: state.dataLevel,
        dataQuality: state.dataQuality as any,
        fitness: state.fitness,
        fatigue: state.fatigue,
        form: state.form,
        acwr: state.acwr?.acwr ?? null,
        monotony: state.monotony?.monotony ?? null,
        trainingCapacity: state.trainingCapacity.score,
        capacityStatus: state.trainingCapacity.status,
        trainingRiskScore: state.trainingRisk.score,
        trainingRiskLevel: state.trainingRisk.level,
        confidence: state.confidence,
        stateJson: state as any,
      },
    });
  }
}
