import { Injectable, Logger } from '@nestjs/common';
import { DailyAthleteState } from '../athlete/types';
import { WorkoutRecommendation, Explanation } from './types';

/**
 * 决策解释引擎
 * 实现PRD第16节要求
 */
@Injectable()
export class ExplanationEngineService {
  private readonly logger = new Logger(ExplanationEngineService.name);

  /**
   * 生成训练建议的解释
   */
  generateExplanation(
    state: DailyAthleteState,
    recommendation: WorkoutRecommendation,
  ): Explanation {
    const reasons = this.generateReasons(state);
    const simple = this.generateSimpleExplanation(state, recommendation, reasons);
    const technical = this.generateTechnicalExplanation(state);

    return {
      simple,
      reasons,
      technical,
    };
  }

  /**
   * 生成用户友好的简单解释
   */
  private generateSimpleExplanation(
    state: DailyAthleteState,
    recommendation: WorkoutRecommendation,
    reasons: string[],
  ): string {
    const capacityStatus = this.getCapacityStatusText(state.trainingCapacity.status);

    if (state.hardSafety?.triggered) {
      return `出于安全考虑，今日建议以恢复为主。${reasons[0] || ''}`;
    }

    if (state.trainingRisk.level === 'high_caution' || state.trainingRisk.level === 'elevated') {
      return `${capacityStatus}，但训练风险偏高，今日安排${recommendation.title}有助于控制负荷。`;
    }

    if (state.dataLevel === 'D' || state.dataLevel === 'C') {
      return `${capacityStatus}，由于历史数据较少，建议保守训练，今日安排${recommendation.title}。`;
    }

    return `${capacityStatus}，${reasons.length > 0 ? reasons[0] : '适合今日的训练安排'}，今日推荐${recommendation.title}。`;
  }

  /**
   * 生成2-3个核心理由
   */
  private generateReasons(state: DailyAthleteState): string[] {
    const reasons: string[] = [];

    // 睡眠相关
    if (state.sleepScore !== undefined && state.sleepScore >= 75) {
      reasons.push('睡眠恢复较好');
    } else if (state.sleepScore !== undefined && state.sleepScore < 60) {
      reasons.push('近期睡眠质量一般');
    }

    // 负荷相关
    if (state.acwr && state.acwr.level === 'optimal') {
      reasons.push('近期训练负荷稳定');
    } else if (state.acwr && state.acwr.level === 'elevated') {
      reasons.push('近期负荷上升较快');
    } else if (state.acwr && state.acwr.level === 'high') {
      reasons.push('训练负荷增幅过高');
    }

    // Form相关
    if (state.form !== undefined) {
      if (state.form >= 5) {
        reasons.push('身体状态良好');
      } else if (state.form <= -10) {
        reasons.push('身体疲劳度较高');
      }
    }

    // 单调性相关
    if (state.monotony && state.monotony.level === 'healthy') {
      reasons.push('训练内容安排合理');
    } else if (state.monotony && state.monotony.level !== 'healthy') {
      reasons.push('近期训练内容较为单一');
    }

    // 风险相关
    if (state.trainingRisk.level === 'low') {
      reasons.push('训练风险较低');
    } else {
      reasons.push('需要注意控制训练强度');
    }

    // 确保返回2-3个理由
    if (reasons.length > 3) {
      return reasons.slice(0, 3);
    }

    // 不足时补充通用理由
    while (reasons.length < 2) {
      if (state.confidence >= 0.7) {
        reasons.push('数据质量较好');
      } else {
        reasons.push('建议仅供参考');
      }
    }

    return reasons;
  }

  /**
   * 生成技术解释（给专业用户看）
   */
  private generateTechnicalExplanation(state: DailyAthleteState): Record<string, any> {
    const technical: Record<string, any> = {
      training_capacity: state.trainingCapacity.score,
      capacity_status: state.trainingCapacity.status,
      training_risk_level: state.trainingRisk.level,
      training_risk_score: state.trainingRisk.score,
      confidence: state.confidence,
      data_level: state.dataLevel,
      data_quality: state.dataQuality.overall,
    };

    if (state.form !== undefined) technical.form = state.form;
    if (state.fitness !== undefined) technical.ctl = state.fitness;
    if (state.fatigue !== undefined) technical.atl = state.fatigue;
    if (state.acwr && state.acwr.acwr !== null) technical.acwr = state.acwr.acwr;
    if (state.monotony && state.monotony.monotony !== null) technical.monotony = state.monotony.monotony;
    if (state.sleepScore !== undefined) technical.sleep_score = state.sleepScore;
    if (state.hrvScore !== undefined) technical.hrv_score = state.hrvScore;

    if (state.hardSafety?.triggered) {
      technical.triggered_rules = state.hardSafety.rules;
    }

    return technical;
  }

  /**
   * 训练能力状态的中文描述
   */
  private getCapacityStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'Ready To Push': '状态极佳',
      'Train Normally': '状态稳定',
      'Reduce Intensity': '状态一般',
      'Recovery Required': '身体需要恢复',
    };
    return statusMap[status] || '状态正常';
  }

  /**
   * 生成调整后的训练解释
   */
  generateAdjustmentExplanation(
    feedbackType: string,
    original: WorkoutRecommendation,
    adjusted: WorkoutRecommendation,
  ): string {
    const feedbackMap: Record<string, string> = {
      too_tired: '你反馈今天感觉疲劳',
      not_enough_time: '你反馈时间有限',
      pain_or_discomfort: '你反馈身体有不适',
      prefer_easy: '你希望轻松一点',
      change_sport: '你更换了运动类型',
      skip_today: '你选择今日休息',
    };

    const feedbackText = feedbackMap[feedbackType] || '根据你的反馈';
    return `${feedbackText}，已为你将原计划${original.title}（${original.durationMinutes}分钟，TSS ${original.expectedTss}）调整为${adjusted.title}（${adjusted.durationMinutes}分钟，TSS ${adjusted.expectedTss}）。`;
  }
}
