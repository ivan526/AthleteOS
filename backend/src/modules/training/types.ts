/**
 * 训练决策相关类型定义
 * 参考PRD第13节
 */

/**
 * 日类型
 */
export type DayType = 'hard' | 'moderate' | 'easy' | 'recovery';

/**
 * 训练强度
 */
export type Intensity = 'easy' | 'moderate' | 'high' | 'max';

/**
 * 跑步训练类型
 */
export type RunningWorkoutType =
  | 'rest_day'
  | 'recovery_run'
  | 'easy_run'
  | 'steady_run'
  | 'tempo_run'
  | 'interval_run'
  | 'long_easy_run'
  | 'mobility';

/**
 * 骑行训练类型
 */
export type CyclingWorkoutType =
  | 'recovery_ride'
  | 'easy_ride'
  | 'endurance_ride'
  | 'tempo_ride'
  | 'sweet_spot_ride'
  | 'interval_ride'
  | 'indoor_easy_ride';

export type SwimmingWorkoutType =
  | 'recovery_swim'
  | 'easy_swim'
  | 'endurance_swim'
  | 'tempo_swim'
  | 'interval_swim';

/**
 * 力量训练类型
 */
export type StrengthWorkoutType = 'mobility' | 'core_strength' | 'light_strength';

/**
 * 所有训练类型
 */
export type WorkoutType =
  | RunningWorkoutType
  | CyclingWorkoutType
  | SwimmingWorkoutType
  | StrengthWorkoutType;

/**
 * 运动类型
 */
export type Sport = 'running' | 'cycling' | 'swimming' | 'strength' | 'other';

/**
 * 训练结构
 */
export interface WorkoutStructure {
  warmup?: string;
  mainSet: string;
  cooldown?: string;
}

/**
 * 训练建议
 */
export interface WorkoutRecommendation {
  sport: Sport;
  type: WorkoutType;
  title: string; // 中文展示标题
  durationMinutes: number;
  expectedTss: number;
  intensity: Intensity;
  structure: WorkoutStructure;
}

/**
 * 决策依据
 */
export interface DecisionEvidence {
  trainingCapacity: number;
  form?: number;
  acwr?: number;
  monotony?: number;
  sleepScore?: number;
  hrvScore?: number;
  trainingRiskLevel: string;
  hardSafetyTriggered: boolean;
  triggeredRules?: string[];
}

/**
 * 训练决策结果
 */
export interface TrainingDecision {
  date: Date;
  dayType: DayType;
  recommendation: WorkoutRecommendation;
  capacity: {
    score: number;
    status: string;
  };
  trainingRisk: {
    level: string;
    label: string;
  };
  decision: {
    confidence: number;
    hardSafetyTriggered: boolean;
    triggeredRules: Array<{
      rule: string;
      condition: string;
      value: string | number;
      action: string;
    }>;
    evidence: string[];
    userFriendlyReason: string;
    technicalReason: string;
  };
  alternatives: Array<{
    label: string;
    action: string;
  }>;
  decisionJson: Record<string, any>;
}

/**
 * 用户反馈类型
 * 参考PRD第14.3节
 */
export type FeedbackType =
  | 'too_tired'
  | 'not_enough_time'
  | 'pain_or_discomfort'
  | 'prefer_easy'
  | 'change_sport'
  | 'indoor_only'
  | 'skip_today'
  | 'completed_as_planned'
  | 'completed_modified'
  | 'completed_more'
  | 'completed_less'
  | 'illness'
  | 'travel'
  | 'stress_high'
  | 'other';

/**
 * 调整后的训练建议
 */
export interface AdjustedRecommendation {
  adjusted: boolean;
  originalRecommendationId?: string;
  newRecommendation: WorkoutRecommendation;
  reason: string;
  decision: {
    hardSafetyTriggered: boolean;
    adjustmentReason: FeedbackType;
    confidence: number;
  };
}

/**
 * 解释内容
 */
export interface Explanation {
  simple: string;
  reasons: string[];
  technical: Record<string, any>;
}
