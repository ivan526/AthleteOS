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
          include: {
            activities: {
              where: {
                providerActivityId: { not: { startsWith: 'demo-' } },
                startTime: {
                  gte: new Date(date.getTime() - 90 * 24 * 60 * 60 * 1000), // 过去90天数据
                },
              },
              orderBy: { startTime: 'desc' },
            },
          },
        },
        dailyAthleteStates: {
          where: {
            date: {
              gte: new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000),
              lte: date,
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!user || user.connectedAccounts.length === 0) {
      throw new Error('用户未连接训练数据源');
    }

    const activities = user.connectedAccounts
      .flatMap((account) => account.activities)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    const wellnessStates = user.dailyAthleteStates;
    const latestWellness = wellnessStates[0];
    const latestSleepScore = this.latestNonNull(wellnessStates, 'sleepScore');
    const latestHrvScore = this.latestNonNull(wellnessStates, 'hrvScore');
    const latestSubjectiveFatigue = this.latestNonNull(wellnessStates, 'subjectiveFatigue');
    const recentSleepScores = wellnessStates
      .map((state) => state.sleepScore)
      .filter((score): score is number => score !== null && score !== undefined)
      .slice(0, 3)
      .reverse();
    const recentHrvScores = wellnessStates
      .map((state) => state.hrvScore)
      .filter((score): score is number => score !== null && score !== undefined)
      .slice(0, 3)
      .reverse();

    // 1. 计算Data Level
    const dataLevel = this.calculateDataLevel(activities);
    this.logger.log(`Data Level for user ${userId}: ${dataLevel}`);

    // 2. 计算数据质量
    const dataQuality = this.calculateDataQuality(activities);

    // 3. 计算CTL/ATL/Form
    const calculatedLoad = this.calculateFitnessFatigueForm(activities, date);
    const hasActivityLoad = activities.some((activity) => activity.tss != null);
    const fitness = hasActivityLoad ? calculatedLoad.fitness : latestWellness?.fitness ?? calculatedLoad.fitness;
    const fatigue = hasActivityLoad ? calculatedLoad.fatigue : latestWellness?.fatigue ?? calculatedLoad.fatigue;
    const form = hasActivityLoad ? calculatedLoad.form : latestWellness?.form ?? calculatedLoad.form;

    // 4. 计算ACWR
    const acwr = this.acwrEngine.calculate(activities, date);

    // 5. 计算Monotony
    const monotony = this.monotonyEngine.calculate(activities, date);

    // 6. 计算训练风险
    const trainingRisk = this.trainingRiskEngine.calculate({
      acwr,
      monotony,
      form,
      sleepScore: latestSleepScore ?? undefined,
      hrvScore: latestHrvScore ?? undefined,
    });

    // 7. 计算训练能力
    const trainingCapacity = this.trainingCapacityEngine.calculate({
      form,
      acwr,
      monotony,
      dataLevel,
      sleepScore: latestSleepScore ?? undefined,
      hrvScore: latestHrvScore ?? undefined,
      subjectiveFatigue: latestSubjectiveFatigue ?? undefined,
      recoveryTrend: this.calculateRecoveryTrend(wellnessStates),
    });

    // 8. 检查硬性安全规则
    const hardSafety = this.hardSafetyRules.checkRules({
      trainingCapacity,
      trainingRisk,
      acwr,
      form,
      recentSleepScores,
      recentHrvScores,
      consecutiveHardDays: this.countConsecutiveHardDays(activities, date),
      consecutiveTrainingDays: this.countConsecutiveTrainingDays(activities, date),
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
      sleepScore: latestSleepScore ?? undefined,
      hrvScore: latestHrvScore ?? undefined,
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
      sleepScore: latestSleepScore ?? undefined,
      hrvScore: latestHrvScore ?? undefined,
      subjectiveFatigue: latestSubjectiveFatigue ?? undefined,
      acwr,
      monotony,
      trainingCapacity,
      trainingRisk,
      hardSafety,
      confidence,
    };
  }

  private latestNonNull<T extends 'sleepScore' | 'hrvScore' | 'subjectiveFatigue'>(
    states: Array<Record<T, number | null>>,
    field: T,
  ): number | null {
    const value = states.find((state) => state[field] !== null && state[field] !== undefined)?.[field];
    return typeof value === 'number' ? value : null;
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

    const tssCoverage = activityCount ? tssCount / activityCount : 0;
    if (historyDays >= 90 && activityCount >= 12 && tssCoverage >= 0.8) {
      overall = 'high';
    } else if (historyDays >= 42 && activityCount >= 6 && tssCoverage >= 0.6) {
      overall = 'medium';
    } else if (historyDays >= 14 && activityCount >= 2) {
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

  private calculateRecoveryTrend(states: Array<{ sleepScore: number | null; hrvScore: number | null }>): number {
    const values = states
      .slice(0, 7)
      .map((state) => [state.sleepScore, state.hrvScore].filter((value): value is number => value !== null && value !== undefined))
      .flat();

    if (values.length === 0) return 70;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private countConsecutiveTrainingDays(activities: Activity[], referenceDate: Date): number {
    return this.countConsecutiveDays(activities, referenceDate, () => true);
  }

  private countConsecutiveHardDays(activities: Activity[], referenceDate: Date): number {
    return this.countConsecutiveDays(activities, referenceDate, (activity) => (activity.tss || 0) >= 80);
  }

  private countConsecutiveDays(
    activities: Activity[],
    referenceDate: Date,
    predicate: (activity: Activity) => boolean,
  ): number {
    let count = 0;
    for (let i = 1; i <= 14; i++) {
      const date = new Date(referenceDate);
      date.setDate(referenceDate.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const hasMatchingActivity = activities.some((activity) => (
        activity.startTime.toISOString().split('T')[0] === dateKey && predicate(activity)
      ));

      if (!hasMatchingActivity) break;
      count++;
    }
    return count;
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(confidences: number[]): number {
    // 不适用的子模型（例如近 7 天训练不足 3 次时的 Monotony）不应拖垮整体建议。
    const available = confidences.filter(confidence => confidence > 0);
    if (available.length === 0) return 0;
    const average = available.reduce((sum, value) => sum + value, 0) / available.length;
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
        sleepScore: state.sleepScore,
        hrvScore: state.hrvScore,
        subjectiveFatigue: state.subjectiveFatigue,
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
        sleepScore: state.sleepScore,
        hrvScore: state.hrvScore,
        subjectiveFatigue: state.subjectiveFatigue,
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
