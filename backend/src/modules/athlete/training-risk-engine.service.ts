import { Injectable, Logger } from '@nestjs/common';
import { TrainingRiskResult, TrainingRiskLevel, AcwrResult, MonotonyResult } from './types';

/**
 * Training Risk (训练风险) 计算引擎
 * 实现PRD第9节要求
 */
@Injectable()
export class TrainingRiskEngineService {
  private readonly logger = new Logger(TrainingRiskEngineService.name);

  /**
   * 计算训练风险
   * 综合考虑ACWR、Monotony、Form、睡眠、HRV等因素
   */
  calculate(params: {
    acwr?: AcwrResult;
    monotony?: MonotonyResult;
    form?: number; // CTL - ATL
    sleepScore?: number;
    hrvScore?: number;
    consecutiveHardDays?: number;
  }): TrainingRiskResult {
    const { acwr, monotony, form, sleepScore, hrvScore, consecutiveHardDays = 0 } = params;

    let riskScore = 0;
    const factors: TrainingRiskResult['mainFactors'] = [];
    let confidence = 0;

    // ACWR风险权重 (30%)
    if (acwr && acwr.acwr !== null) {
      const acwrRisk = this.getAcwrRisk(acwr.level);
      riskScore += acwrRisk * 0.3;
      confidence += 0.3 * acwr.confidence;

      if (acwrRisk > 0.3) {
        factors.push({
          factor: 'acwr',
          value: acwr.acwr.toFixed(2),
          message: this.getAcwrRiskMessage(acwr.level),
        });
      }
    } else {
      confidence += 0.3 * 0.3;
    }

    // Monotony风险权重 (20%)
    if (monotony && monotony.monotony !== null) {
      const monotonyRisk = this.getMonotonyRisk(monotony.level);
      riskScore += monotonyRisk * 0.2;
      confidence += 0.2 * monotony.confidence;

      if (monotonyRisk > 0.3) {
        factors.push({
          factor: 'monotony',
          value: monotony.monotony.toFixed(2),
          message: this.getMonotonyRiskMessage(monotony.level),
        });
      }
    } else {
      confidence += 0.2 * 0.5;
    }

    // Form风险权重 (20%) - 数值越低越疲劳
    if (form !== undefined && form !== null) {
      confidence += 0.2;
      const formRisk = this.getFormRisk(form);
      riskScore += formRisk * 0.2;

      if (formRisk > 0.3) {
        factors.push({
          factor: 'form',
          value: form.toFixed(1),
          message: form < -20 ? '当前身体疲劳度较高' : '身体状态一般',
        });
      }
    } else {
      confidence += 0.2 * 0.4;
    }

    // 睡眠风险权重 (15%)
    if (sleepScore !== undefined && sleepScore !== null) {
      confidence += 0.15;
      const sleepRisk = this.getSleepRisk(sleepScore);
      riskScore += sleepRisk * 0.15;

      if (sleepRisk > 0.3) {
        factors.push({
          factor: 'sleep',
          value: sleepScore.toFixed(0),
          message: '近期睡眠质量不佳',
        });
      }
    } else {
      confidence += 0.15 * 0.3;
    }

    // HRV风险权重 (10%)
    if (hrvScore !== undefined && hrvScore !== null) {
      confidence += 0.1;
      const hrvRisk = this.getHrvRisk(hrvScore);
      riskScore += hrvRisk * 0.1;

      if (hrvRisk > 0.3) {
        factors.push({
          factor: 'hrv',
          value: hrvScore.toFixed(0),
          message: '心率变异性较低，身体恢复不足',
        });
      }
    } else {
      confidence += 0.1 * 0.3;
    }

    confidence += 0.05;

    // 连续高强度训练风险 (5%)
    if (consecutiveHardDays >= 3) {
      riskScore += 0.05 * consecutiveHardDays;
      factors.push({
        factor: 'consecutive_hard_days',
        value: consecutiveHardDays,
        message: `连续 ${consecutiveHardDays} 天高强度训练`,
      });
    }

    // 确保风险分数在0-1之间
    riskScore = Math.max(0, Math.min(1, riskScore));
    const level = this.getRiskLevel(riskScore);

    return {
      score: riskScore,
      level,
      userLabel: this.getUserLabel(level),
      confidence: Math.max(0, Math.min(1, confidence)),
      dataQuality: confidence > 0.7 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      mainFactors: factors,
      safeRecommendation: this.getSafeRecommendation(level),
    };
  }

  private getAcwrRisk(level: string): number {
    switch (level) {
      case 'underload': return 0.1;
      case 'optimal': return 0.2;
      case 'elevated': return 0.7;
      case 'high': return 0.95;
      default: return 0.3;
    }
  }

  private getAcwrRiskMessage(level: string): string {
    switch (level) {
      case 'elevated': return '近期训练负荷上升偏快';
      case 'high': return '训练负荷增幅过高，受伤风险增加';
      default: return '';
    }
  }

  private getMonotonyRisk(level: string): number {
    switch (level) {
      case 'healthy': return 0.1;
      case 'warning': return 0.3;
      case 'high': return 0.6;
      case 'severe': return 0.85;
      default: return 0.2;
    }
  }

  private getMonotonyRiskMessage(level: string): string {
    switch (level) {
      case 'warning': return '训练内容较为单一';
      case 'high': return '训练单调性较高，建议增加训练多样性';
      case 'severe': return '训练内容高度重复，受伤风险较高';
      default: return '';
    }
  }

  private getFormRisk(form: number): number {
    if (form < -25) return 0.9; // 极度疲劳
    if (form < -15) return 0.7; // 中度疲劳
    if (form < -5) return 0.4; // 轻度疲劳
    if (form > 10) return 0.1; // 状态很好
    return 0.2;
  }

  private getSleepRisk(score: number): number {
    if (score < 50) return 0.9;
    if (score < 65) return 0.6;
    if (score < 75) return 0.3;
    return 0.1;
  }

  private getHrvRisk(score: number): number {
    if (score < 50) return 0.8;
    if (score < 65) return 0.5;
    if (score < 75) return 0.2;
    return 0.1;
  }

  /**
   * 风险等级映射
   * 参考PRD第1388-1392行
   */
  private getRiskLevel(score: number): TrainingRiskLevel {
    if (score < 0.25) return 'low';
    if (score < 0.5) return 'moderate';
    if (score < 0.75) return 'elevated';
    return 'high_caution';
  }

  /**
   * 用户友好的风险标签
   * 参考PRD第1388-1392行
   */
  private getUserLabel(level: TrainingRiskLevel): string {
    switch (level) {
      case 'low': return '训练风险较低';
      case 'moderate': return '训练风险中等，建议控制强度';
      case 'elevated': return '训练风险偏高，建议降低强度';
      case 'high_caution': return '训练风险较高，建议以恢复为主';
    }
  }

  private getSafeRecommendation(level: TrainingRiskLevel): string {
    switch (level) {
      case 'low': return '可以按照计划进行训练';
      case 'moderate': return '建议适当控制训练强度';
      case 'elevated': return '建议降低训练强度，多注意恢复';
      case 'high_caution': return '建议以恢复性训练为主，或充分休息';
    }
  }
}
