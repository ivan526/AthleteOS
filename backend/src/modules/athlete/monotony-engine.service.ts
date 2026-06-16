import { Injectable, Logger } from '@nestjs/common';
import { Activity } from '@prisma/client';
import { MonotonyResult, DataQuality, MonotonyLevel } from './types';

/**
 * Monotony (训练单调性) 计算引擎
 * 实现PRD第11节要求
 */
@Injectable()
export class MonotonyEngineService {
  private readonly logger = new Logger(MonotonyEngineService.name);

  /**
   * 计算训练单调性
   * monotony = mean_daily_load / std_daily_load
   * 基于过去7天的每日TSS
   */
  calculate(activities: Activity[], referenceDate: Date = new Date()): MonotonyResult {
    const sevenDaysAgo = new Date(referenceDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 过滤过去7天的活动
    const last7Days = activities.filter(
      activity => activity.startTime >= sevenDaysAgo && activity.startTime < referenceDate,
    );

    // 按日期分组计算每日TSS
    const dailyTss: Record<string, number> = {};
    for (const activity of last7Days) {
      const dateStr = activity.startTime.toISOString().split('T')[0];
      dailyTss[dateStr] = (dailyTss[dateStr] || 0) + (activity.tss || 0);
    }

    const tssValues = Object.values(dailyTss);
    const trainingDays = tssValues.filter(tss => tss > 0).length;

    // 过去7天训练天数不足3天
    if (trainingDays < 3) {
      return {
        monotony: null,
        level: 'healthy',
        dataQuality: 'insufficient',
        confidence: 0,
        message: '近7天训练数据不足，无法计算单调性',
      };
    }

    const mean = this.calculateMean(tssValues);
    const std = this.calculateStandardDeviation(tssValues);

    // 标准差为0的情况（每天负荷完全一样）
    if (std === 0) {
      return {
        monotony: 3.0, // PRD要求返回3.0
        level: 'severe',
        dataQuality: 'medium',
        confidence: 0.7,
        message: '近期训练负荷高度一致，建议适当变化训练内容',
      };
    }

    const monotony = mean / std;
    const level = this.getMonotonyLevel(monotony);

    // 数据质量评估
    const tssCount = last7Days.filter(a => a.tss != null).length;
    const dataQuality: DataQuality = tssCount >= 5 ? 'high' : 'medium';
    const confidence = dataQuality === 'high' ? 0.8 : 0.6;

    // 周总负荷很低的情况
    const weeklyTss = tssValues.reduce((sum, tss) => sum + tss, 0);
    if (weeklyTss < 100) {
      return {
        monotony,
        level,
        dataQuality: 'low',
        confidence: confidence * 0.7,
        message: '周总负荷较低，单调性参考价值有限',
      };
    }

    return {
      monotony,
      level,
      dataQuality,
      confidence,
    };
  }

  /**
   * 计算平均值
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 计算标准差
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Monotony等级映射
   * 参考PRD第1407-1411行
   */
  private getMonotonyLevel(monotony: number): MonotonyLevel {
    if (monotony < 1.5) return 'healthy';
    if (monotony < 2.0) return 'warning';
    if (monotony < 2.5) return 'high';
    return 'severe';
  }
}
