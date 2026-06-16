// 通用类型定义

/**
 * 数据等级
 * D: <14天数据
 * C: 14-41天数据
 * B: 42-89天数据
 * A: >=90天数据
 */
export type DataLevel = 'A' | 'B' | 'C' | 'D';

/**
 * 训练风险等级
 */
export type TrainingRiskLevel = 'low' | 'moderate' | 'elevated' | 'high_caution';

/**
 * 能力状态
 */
export type CapacityStatus =
  | 'Ready To Push'
  | 'Train Normally'
  | 'Reduce Intensity'
  | 'Recovery Required';

/**
 * ACWR等级
 */
export type AcwrLevel = 'underload' | 'optimal' | 'elevated' | 'high';

/**
 * Monotony等级
 */
export type MonotonyLevel = 'healthy' | 'warning' | 'high' | 'severe';

/**
 * 数据质量
 */
export type DataQuality = 'high' | 'medium' | 'low' | 'insufficient';

/**
 * 数据质量详情
 */
export interface DataQualityDetail {
  overall: DataQuality;
  historyDays: number;
  activityCount: number;
  missingSleepDays14d?: number;
  missingHrvDays14d?: number;
}

/**
 * ACWR计算结果
 */
export interface AcwrResult {
  acwr: number | null;
  acuteLoad: number;
  chronicLoad: number;
  level: AcwrLevel;
  dataQuality: DataQuality;
  confidence: number;
  message?: string;
}

/**
 * Monotony计算结果
 */
export interface MonotonyResult {
  monotony: number | null;
  level: MonotonyLevel;
  dataQuality: DataQuality;
  confidence: number;
  message?: string;
}

/**
 * 训练风险计算结果
 */
export interface TrainingRiskResult {
  score: number;
  level: TrainingRiskLevel;
  userLabel: string;
  confidence: number;
  dataQuality: DataQuality;
  mainFactors: Array<{
    factor: string;
    value: number | string;
    message: string;
  }>;
  safeRecommendation: string;
}

/**
 * 训练能力计算结果
 */
export interface TrainingCapacityResult {
  score: number;
  status: CapacityStatus;
  confidence: number;
  dataQuality: DataQuality;
  subscores: Record<string, number>;
  summary: string;
}

/**
 * 硬性安全规则触发结果
 */
export interface HardSafetyResult {
  triggered: boolean;
  rules: Array<{
    rule: string;
    condition: string;
    value: number | string;
    action: string;
  }>;
}

/**
 * 每日运动员状态
 */
export interface DailyAthleteState {
  userId: string;
  date: Date;
  dataLevel: DataLevel;
  dataQuality: DataQualityDetail;
  fitness?: number; // CTL
  fatigue?: number; // ATL
  form?: number; // CTL - ATL
  sleepScore?: number;
  hrvScore?: number;
  acwr?: AcwrResult;
  monotony?: MonotonyResult;
  strain?: number;
  adherence?: number;
  subjectiveFatigue?: number;
  trainingCapacity: TrainingCapacityResult;
  trainingRisk: TrainingRiskResult;
  hardSafety?: HardSafetyResult;
  confidence: number;
}
