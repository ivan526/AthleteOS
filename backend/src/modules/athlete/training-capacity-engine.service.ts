import { Injectable, Logger } from '@nestjs/common';
import { TrainingCapacityResult, CapacityStatus, AcwrResult, MonotonyResult } from './types';

/**
 * Training Capacity (训练能力) 计算引擎
 * 实现PRD第8节要求
 * 这是用户可见的唯一核心指标，范围0-100
 */
@Injectable()
export class TrainingCapacityEngineService {
  private readonly logger = new Logger(TrainingCapacityEngineService.name);

  /**
   * 权重配置 (参考PRD第1379-1386行)
   */
  private readonly WEIGHTS = {
    sleep: 0.20,
    hrv: 0.10,
    form: 0.15,
    acwr: 0.10,
    monotony: 0.10,
    adherence: 0.15,
    subjectiveFatigue: 0.10,
    recoveryTrend: 0.10,
  };

  /**
   * 计算训练能力评分 (0-100)
   */
  calculate(params: {
    sleepScore?: number; // 0-100
    hrvScore?: number; // 0-100
    form?: number; // CTL - ATL, 通常范围 -30 ~ +30
    acwr?: AcwrResult;
    monotony?: MonotonyResult;
    adherence?: number; // 0-1
    subjectiveFatigue?: number; // 1-10 (1=精力充沛, 10=极度疲劳)
    recoveryTrend?: number; // 0-100 (最近几天恢复趋势)
    dataLevel?: string;
  }): TrainingCapacityResult {
    const {
      sleepScore,
      hrvScore,
      form,
      acwr,
      monotony,
      adherence = 0.8, // 默认完成率
      subjectiveFatigue = 5, // 默认中等疲劳
      recoveryTrend = 70, // 默认恢复趋势良好
      dataLevel = 'C',
    } = params;

    const subscores: Record<string, number> = {};
    let totalScore = 0;
    let totalWeight = 0;
    let confidence = 1.0;

    // 睡眠评分
    if (sleepScore !== undefined && sleepScore !== null) {
      subscores.sleep = sleepScore;
      totalScore += sleepScore * this.WEIGHTS.sleep;
      totalWeight += this.WEIGHTS.sleep;
    } else {
      // 缺少数据时使用默认值，置信度降低
      subscores.sleep = 70;
      totalScore += 70 * this.WEIGHTS.sleep;
      totalWeight += this.WEIGHTS.sleep;
      confidence *= 0.8;
    }

    // HRV评分
    if (hrvScore !== undefined && hrvScore !== null) {
      subscores.hrv = hrvScore;
      totalScore += hrvScore * this.WEIGHTS.hrv;
      totalWeight += this.WEIGHTS.hrv;
    }

    // Form评分 (转换为0-100)
    if (form !== undefined && form !== null) {
      const formScore = this.normalizeForm(form);
      subscores.form = formScore;
      totalScore += formScore * this.WEIGHTS.form;
      totalWeight += this.WEIGHTS.form;
    } else {
      subscores.form = 65;
      totalScore += 65 * this.WEIGHTS.form;
      totalWeight += this.WEIGHTS.form;
      confidence *= 0.9;
    }

    // ACWR评分 (转换为0-100)
    if (acwr && acwr.acwr !== null) {
      const acwrScore = this.normalizeAcwr(acwr.level);
      subscores.acwr = acwrScore;
      totalScore += acwrScore * this.WEIGHTS.acwr;
      totalWeight += this.WEIGHTS.acwr;
      confidence *= acwr.confidence;
    } else {
      subscores.acwr = 70;
      totalScore += 70 * this.WEIGHTS.acwr;
      totalWeight += this.WEIGHTS.acwr;
      confidence *= 0.9;
    }

    // Monotony评分 (转换为0-100)
    if (monotony && monotony.monotony !== null) {
      const monotonyScore = this.normalizeMonotony(monotony.level);
      subscores.monotony = monotonyScore;
      totalScore += monotonyScore * this.WEIGHTS.monotony;
      totalWeight += this.WEIGHTS.monotony;
      confidence *= monotony.confidence;
    } else {
      subscores.monotony = 75;
      totalScore += 75 * this.WEIGHTS.monotony;
      totalWeight += this.WEIGHTS.monotony;
      confidence *= 0.95;
    }

    // 训练完成率
    const adherenceScore = adherence * 100;
    subscores.adherence = adherenceScore;
    totalScore += adherenceScore * this.WEIGHTS.adherence;
    totalWeight += this.WEIGHTS.adherence;

    // 主观疲劳 (转换为0-100，1=100分, 10=0分)
    const fatigueScore = 100 - (subjectiveFatigue - 1) * 10;
    subscores.subjectiveFatigue = fatigueScore;
    totalScore += fatigueScore * this.WEIGHTS.subjectiveFatigue;
    totalWeight += this.WEIGHTS.subjectiveFatigue;

    // 恢复趋势
    subscores.recoveryTrend = recoveryTrend;
    totalScore += recoveryTrend * this.WEIGHTS.recoveryTrend;
    totalWeight += this.WEIGHTS.recoveryTrend;

    // 计算最终得分 (0-100)
    let finalScore = Math.round(totalScore / totalWeight);
    finalScore = Math.max(0, Math.min(100, finalScore));

    // 根据数据等级调整置信度
    if (dataLevel === 'D') confidence *= 0.5;
    else if (dataLevel === 'C') confidence *= 0.7;
    else if (dataLevel === 'B') confidence *= 0.9;

    const status = this.getCapacityStatus(finalScore);
    const summary = this.getSummary(status, finalScore);

    return {
      score: finalScore,
      status,
      confidence: Math.max(0, Math.min(1, confidence)),
      dataQuality: confidence > 0.7 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      subscores,
      summary,
    };
  }

  /**
   * 将Form值转换为0-100分
   * Form通常范围: -30 (极度疲劳) ~ +30 (状态极佳)
   */
  private normalizeForm(form: number): number {
    if (form >= 20) return 95;
    if (form >= 10) return 85;
    if (form >= 0) return 75;
    if (form >= -10) return 60;
    if (form >= -20) return 40;
    return 20;
  }

  /**
   * 将ACWR等级转换为0-100分
   */
  private normalizeAcwr(level: string): number {
    switch (level) {
      case 'optimal': return 90;
      case 'underload': return 75;
      case 'elevated': return 40;
      case 'high': return 20;
      default: return 60;
    }
  }

  /**
   * 将Monotony等级转换为0-100分
   */
  private normalizeMonotony(level: string): number {
    switch (level) {
      case 'healthy': return 90;
      case 'warning': return 70;
      case 'high': return 45;
      case 'severe': return 25;
      default: return 75;
    }
  }

  /**
   * 根据得分确定能力状态
   * 参考PRD第1374-1377行
   */
  private getCapacityStatus(score: number): CapacityStatus {
    if (score >= 81) return 'Ready To Push';
    if (score >= 61) return 'Train Normally';
    if (score >= 41) return 'Reduce Intensity';
    return 'Recovery Required';
  }

  /**
   * 生成用户友好的总结
   */
  private getSummary(status: CapacityStatus, score: number): string {
    switch (status) {
      case 'Ready To Push':
        return `状态极佳（${score}分），可以尝试更高强度的训练`;
      case 'Train Normally':
        return `状态稳定（${score}分），适合完成计划训练`;
      case 'Reduce Intensity':
        return `状态一般（${score}分），建议适当降低训练强度`;
      case 'Recovery Required':
        return `身体需要恢复（${score}分），建议以休息或恢复性训练为主`;
    }
  }
}
