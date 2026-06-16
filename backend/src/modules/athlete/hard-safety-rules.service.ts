import { Injectable, Logger } from '@nestjs/common';
import { HardSafetyResult, TrainingCapacityResult, TrainingRiskResult, AcwrResult } from './types';

/**
 * Hard Safety Rules (硬性安全规则) 引擎
 * 实现PRD第12节要求
 * 所有规则具有最高优先级，一旦触发必须强制执行
 */
@Injectable()
export class HardSafetyRulesService {
  private readonly logger = new Logger(HardSafetyRulesService.name);

  /**
   * 检查所有安全规则
   * PRD 12.2 8条安全规则
   */
  checkRules(params: {
    trainingCapacity: TrainingCapacityResult;
    trainingRisk: TrainingRiskResult;
    acwr?: AcwrResult;
    form?: number;
    consecutiveHardDays?: number;
    consecutiveTrainingDays?: number;
    recentSleepScores?: number[]; // 最近3天睡眠评分
    recentHrvScores?: number[]; // 最近3天HRV评分
  }): HardSafetyResult {
    const {
      trainingCapacity,
      trainingRisk,
      acwr,
      form,
      consecutiveHardDays = 0,
      consecutiveTrainingDays = 0,
      recentSleepScores = [],
      recentHrvScores = [],
    } = params;

    const triggeredRules: HardSafetyResult['rules'] = [];

    // Rule 1: Training Capacity < 40 → 强制恢复
    if (trainingCapacity.score < 40) {
      triggeredRules.push({
        rule: 'Training Capacity Protection',
        condition: 'training_capacity < 40',
        value: trainingCapacity.score,
        action: '强制恢复日或休息日，禁止高强度训练',
      });
    }

    // Rule 2: Form < -25 → 禁止高强度
    if (form !== undefined && form < -25) {
      triggeredRules.push({
        rule: 'Extreme Fatigue Protection',
        condition: 'form < -25',
        value: form,
        action: '禁止高强度训练，建议恢复跑、骑行或休息',
      });
    }

    // Rule 3: ACWR > 1.5 → 禁止高强度
    if (acwr && acwr.acwr !== null && acwr.acwr > 1.5 && acwr.dataQuality !== 'insufficient') {
      triggeredRules.push({
        rule: 'ACWR Protection',
        condition: 'acwr > 1.5',
        value: acwr.acwr.toFixed(2),
        action: '禁止高强度训练，建议轻松日或恢复日',
      });
    }

    // Rule 4: Training Risk Score > 0.75 → 恢复模式
    if (trainingRisk.score > 0.75) {
      triggeredRules.push({
        rule: 'Training Risk Protection',
        condition: 'training_risk_score > 0.75',
        value: trainingRisk.score.toFixed(2),
        action: '强制恢复模式',
      });
    }

    // Rule 5: 连续3天高难度训练 → 轻松日
    if (consecutiveHardDays >= 3) {
      triggeredRules.push({
        rule: 'Intensity Density Protection',
        condition: '最近3天高强度训练',
        value: consecutiveHardDays,
        action: '建议轻松日',
      });
    }

    // Rule 6: 连续7天训练 → 强制休息
    if (consecutiveTrainingDays >= 7) {
      triggeredRules.push({
        rule: 'Rest Day Protection',
        condition: '最近7天连续训练',
        value: consecutiveTrainingDays,
        action: '强制休息日',
      });
    }

    // Rule 7: 连续3天睡眠评分 < 60 → 禁止高强度
    if (recentSleepScores.length >= 3 && recentSleepScores.every(score => score < 60)) {
      triggeredRules.push({
        rule: 'Sleep Protection',
        condition: '最近3天睡眠评分均<60',
        value: recentSleepScores.join(', '),
        action: '禁止高强度训练',
      });
    }

    // Rule 8: 连续3天HRV下降超过15% → 恢复模式
    if (this.checkHrvDrop(recentHrvScores)) {
      triggeredRules.push({
        rule: 'HRV Protection',
        condition: '最近3天HRV持续下降超过15%',
        value: '连续下降',
        action: '强制恢复模式',
      });
    }

    return {
      triggered: triggeredRules.length > 0,
      rules: triggeredRules,
    };
  }

  /**
   * 检查HRV是否连续3天下降超过15%
   */
  private checkHrvDrop(hrvScores: number[]): boolean {
    if (hrvScores.length < 3) return false;

    // 取最近3天
    const [d1, d2, d3] = hrvScores.slice(-3);

    // 检查是否连续下降
    if (d1 > d2 && d2 > d3) {
      // 计算总降幅
      const dropPercent = ((d1 - d3) / d1) * 100;
      return dropPercent >= 15;
    }

    return false;
  }

  /**
   * 根据触发的安全规则，确定允许的训练类型
   */
  getAllowedWorkoutTypes(triggeredRules: HardSafetyResult['rules']): string[] {
    if (triggeredRules.length === 0) {
      // 没有触发规则，允许所有类型
      return [
        'recovery_run', 'easy_run', 'steady_run', 'tempo_run', 'interval_run', 'long_easy_run',
        'recovery_ride', 'easy_ride', 'endurance_ride', 'tempo_ride', 'sweet_spot_ride', 'interval_ride',
        'mobility', 'core_strength', 'light_strength',
      ];
    }

    // 有触发规则，只允许低强度活动
    const allowed = ['recovery_run', 'recovery_ride', 'mobility'];

    // 检查是否允许轻松跑/骑
    const hasStrictRule = triggeredRules.some(
      r => r.rule.includes('Recovery Required') || r.rule.includes('强制恢复模式') || r.rule.includes('强制休息日'),
    );

    if (!hasStrictRule) {
      allowed.push('easy_run', 'easy_ride', 'light_strength');
    }

    return allowed;
  }

  /**
   * 是否需要强制休息
   */
  isRestDayRequired(triggeredRules: HardSafetyResult['rules']): boolean {
    return triggeredRules.some(
      r => r.action.includes('强制休息日') || r.action.includes('强制恢复模式'),
    );
  }
}
