import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DailyAthleteState } from '../athlete/types';
import { HardSafetyRulesService } from '../athlete/hard-safety-rules.service';
import { WorkoutGeneratorService } from './workout-generator.service';
import { ExplanationEngineService } from './explanation-engine.service';
import { TrainingDecision, WorkoutRecommendation, FeedbackType, AdjustedRecommendation } from './types';

/**
 * 训练决策引擎
 * 实现PRD第13节要求
 */
@Injectable()
export class TrainingDecisionEngineService {
  private readonly logger = new Logger(TrainingDecisionEngineService.name);

  constructor(
    private prisma: PrismaService,
    private hardSafetyRules: HardSafetyRulesService,
    private workoutGenerator: WorkoutGeneratorService,
    private explanationEngine: ExplanationEngineService,
  ) {}

  /**
   * 生成每日训练决策
   */
  async generateDailyDecision(
    userId: string,
    state: DailyAthleteState,
    date: Date = new Date(),
  ): Promise<TrainingDecision> {
    // 获取用户偏好
    const userProfile = await this.prisma.athleteProfile.findUnique({
      where: { userId },
    });

    const preferredSport = userProfile?.primarySport || 'running';
    const availableTimeMinutes = userProfile?.weeklyAvailableDays ? 60 : 45; // 默认时长

    // 获取安全规则允许的训练类型
    const allowedTypes = state.hardSafety
      ? this.hardSafetyRules.getAllowedWorkoutTypes(state.hardSafety.rules)
      : undefined;

    // 生成训练建议
    const recommendation = this.workoutGenerator.generateWorkout(
      state,
      preferredSport as any,
      availableTimeMinutes,
      allowedTypes as any,
    );

    // 生成解释
    const explanation = this.explanationEngine.generateExplanation(state, recommendation);

    // 准备决策依据
    const evidence = this.buildEvidence(state);

    // 构建决策对象
    const decision: TrainingDecision = {
      date,
      dayType: this.getDayTypeFromCapacity(state.trainingCapacity.score),
      recommendation,
      capacity: {
        score: state.trainingCapacity.score,
        status: state.trainingCapacity.status,
      },
      trainingRisk: {
        level: state.trainingRisk.level,
        label: state.trainingRisk.userLabel,
      },
      decision: {
        confidence: state.confidence,
        hardSafetyTriggered: state.hardSafety?.triggered || false,
        triggeredRules: state.hardSafety?.rules || [],
        evidence: evidence.map(e => `${e.key}=${e.value}`),
        userFriendlyReason: explanation.simple,
        technicalReason: this.buildTechnicalReason(state),
      },
      alternatives: this.buildAlternatives(recommendation),
      decisionJson: this.buildDecisionJson(userId, state, recommendation, explanation),
    };

    // 保存到数据库
    await this.saveDecision(userId, date, decision);

    return decision;
  }

  /**
   * 处理用户反馈，调整训练建议
   */
  async adjustRecommendation(
    userId: string,
    originalRecommendationId: string,
    feedbackType: FeedbackType,
    params: {
      subjectiveFatigue?: number;
      pain?: boolean;
      painArea?: string;
      availableTimeMinutes?: number;
      preferredSport?: string;
      note?: string;
    },
  ): Promise<AdjustedRecommendation> {
    // 获取原始建议
    const original = await this.prisma.dailyRecommendation.findUnique({
      where: { id: originalRecommendationId },
      include: { user: true },
    });

    if (!original) {
      throw new Error('训练建议不存在');
    }

    // 如果是疼痛反馈，强制执行恢复训练
    if (feedbackType === 'pain_or_discomfort' || params.pain) {
      const adjustedWorkout = this.workoutGenerator.adjustWorkout(
        {
          sport: original.sport as any,
          type: original.type as any,
          title: original.title,
          durationMinutes: original.durationMinutes,
          expectedTss: original.expectedTss,
          intensity: original.intensity as any,
          structure: original.structure as any,
        },
        'pain_or_discomfort',
      );

      // 保存用户反馈
      await this.saveUserFeedback(userId, originalRecommendationId, feedbackType, params);

      // 保存调整后的建议
      const newRecommendation = await this.saveAdjustedRecommendation(
        userId,
        original,
        adjustedWorkout,
        feedbackType,
      );

      return {
        adjusted: true,
        originalRecommendationId,
        newRecommendation: adjustedWorkout,
        reason: '你反馈身体有不适，已为你调整为恢复性训练。如有持续疼痛，请咨询专业医生。',
        decision: {
          hardSafetyTriggered: true,
          adjustmentReason: feedbackType,
          confidence: 0.9,
        },
      };
    }

    // 普通调整
    const originalWorkout: WorkoutRecommendation = {
      sport: original.sport as any,
      type: original.type as any,
      title: original.title,
      durationMinutes: original.durationMinutes,
      expectedTss: original.expectedTss,
      intensity: original.intensity as any,
      structure: original.structure as any,
    };

    const adjustedWorkout = this.workoutGenerator.adjustWorkout(
      originalWorkout,
      feedbackType,
      params.availableTimeMinutes,
      params.preferredSport as any,
    );

    // 保存用户反馈
    await this.saveUserFeedback(userId, originalRecommendationId, feedbackType, params);

    // 保存调整后的建议
    const newRecommendation = await this.saveAdjustedRecommendation(
      userId,
      original,
      adjustedWorkout,
      feedbackType,
    );

    // 生成调整解释
    const reason = this.explanationEngine.generateAdjustmentExplanation(
      feedbackType,
      originalWorkout,
      adjustedWorkout,
    );

    return {
      adjusted: true,
      originalRecommendationId,
      newRecommendation: adjustedWorkout,
      reason,
      decision: {
        hardSafetyTriggered: false,
        adjustmentReason: feedbackType,
        confidence: 0.8,
      },
    };
  }

  /**
   * 构建决策依据列表
   */
  private buildEvidence(state: DailyAthleteState): Array<{ key: string; value: string | number }> {
    const evidence: Array<{ key: string; value: string | number }> = [];

    evidence.push({ key: 'training_capacity', value: state.trainingCapacity.score });
    if (state.form !== undefined) evidence.push({ key: 'form', value: state.form });
    if (state.acwr && state.acwr.acwr !== null) evidence.push({ key: 'acwr', value: state.acwr.acwr.toFixed(2) });
    if (state.sleepScore !== undefined) evidence.push({ key: 'sleep_score', value: state.sleepScore });

    return evidence;
  }

  /**
   * 构建技术原因说明
   */
  private buildTechnicalReason(state: DailyAthleteState): string {
    const parts: string[] = [];
    parts.push(`Training Capacity ${state.trainingCapacity.score}`);
    if (state.form !== undefined) parts.push(`Form ${state.form}`);
    if (state.acwr && state.acwr.acwr !== null) parts.push(`ACWR ${state.acwr.acwr.toFixed(2)}`);
    if (state.trainingRisk.level) parts.push(`Risk ${state.trainingRisk.level}`);
    if (state.hardSafety?.triggered) parts.push('Hard Safety Rules triggered');
    return parts.join(', ');
  }

  /**
   * 构建可选操作列表
   */
  private buildAlternatives(recommendation: WorkoutRecommendation): Array<{ label: string; action: string }> {
    const alternatives = [
      { label: '太累了', action: 'reduce_intensity' },
      { label: '只有30分钟', action: 'shorten_workout' },
      { label: '腿部不适', action: 'pain_or_discomfort' },
    ];

    if (recommendation.sport === 'running') {
      alternatives.push({ label: '换成骑行', action: 'change_sport_to_cycling' });
    } else if (recommendation.sport === 'cycling') {
      alternatives.push({ label: '换成跑步', action: 'change_sport_to_running' });
    }

    alternatives.push(
      { label: '今天休息', action: 'skip_today' },
      { label: '已完成', action: 'mark_completed' },
    );

    return alternatives;
  }

  /**
   * 构建decision_json（用于审计和回溯）
   */
  private buildDecisionJson(
    userId: string,
    state: DailyAthleteState,
    recommendation: WorkoutRecommendation,
    explanation: any,
  ): Record<string, any> {
    return {
      userId,
      state,
      recommendation,
      explanation,
      generatedAt: new Date().toISOString(),
      version: '1.1',
    };
  }

  /**
   * 根据能力分数确定日类型
   */
  private getDayTypeFromCapacity(score: number): any {
    if (score >= 80) return 'hard';
    if (score >= 61) return 'moderate';
    if (score >= 41) return 'easy';
    return 'recovery';
  }

  /**
   * 保存训练决策到数据库
   */
  private async saveDecision(userId: string, date: Date, decision: TrainingDecision) {
    const dateOnly = new Date(date.toISOString().split('T')[0]);

    await this.prisma.dailyRecommendation.upsert({
      where: {
        userId_date: {
          userId,
          date: dateOnly,
        },
      },
      update: {
        trainingCapacity: decision.capacity.score,
        capacityStatus: decision.capacity.status,
        trainingRiskScore: decision.trainingRisk.level === 'low' ? 0.2 : decision.trainingRisk.level === 'moderate' ? 0.4 : decision.trainingRisk.level === 'elevated' ? 0.6 : 0.8,
        trainingRiskLevel: decision.trainingRisk.level,
        dataLevel: 'B', // TODO: 从state获取
        availableTimeMinutes: decision.recommendation.durationMinutes,
        preferredSport: decision.recommendation.sport,
        sport: decision.recommendation.sport,
        type: decision.recommendation.type,
        title: decision.recommendation.title,
        durationMinutes: decision.recommendation.durationMinutes,
        expectedTss: decision.recommendation.expectedTss,
        intensity: decision.recommendation.intensity,
        structure: decision.recommendation.structure as any,
        dayType: decision.dayType,
        hardSafetyTriggered: decision.decision.hardSafetyTriggered,
        triggeredRules: decision.decision.triggeredRules as any,
        evidence: decision.decision.evidence as any,
        userFriendlyReason: decision.decision.userFriendlyReason,
        technicalReason: decision.decision.technicalReason,
        confidence: decision.decision.confidence,
        status: 'active',
        decisionJson: decision.decisionJson as any,
      },
      create: {
        userId,
        date: dateOnly,
        trainingCapacity: decision.capacity.score,
        capacityStatus: decision.capacity.status,
        trainingRiskScore: decision.trainingRisk.level === 'low' ? 0.2 : decision.trainingRisk.level === 'moderate' ? 0.4 : decision.trainingRisk.level === 'elevated' ? 0.6 : 0.8,
        trainingRiskLevel: decision.trainingRisk.level,
        dataLevel: 'B', // TODO: 从state获取
        availableTimeMinutes: decision.recommendation.durationMinutes,
        preferredSport: decision.recommendation.sport,
        sport: decision.recommendation.sport,
        type: decision.recommendation.type,
        title: decision.recommendation.title,
        durationMinutes: decision.recommendation.durationMinutes,
        expectedTss: decision.recommendation.expectedTss,
        intensity: decision.recommendation.intensity,
        structure: decision.recommendation.structure as any,
        dayType: decision.dayType,
        hardSafetyTriggered: decision.decision.hardSafetyTriggered,
        triggeredRules: decision.decision.triggeredRules as any,
        evidence: decision.decision.evidence as any,
        userFriendlyReason: decision.decision.userFriendlyReason,
        technicalReason: decision.decision.technicalReason,
        confidence: decision.decision.confidence,
        status: 'active',
        decisionJson: decision.decisionJson as any,
      },
    });
  }

  /**
   * 保存用户反馈
   */
  private async saveUserFeedback(
    userId: string,
    recommendationId: string,
    feedbackType: FeedbackType,
    params: any,
  ) {
    await this.prisma.userFeedback.create({
      data: {
        userId,
        recommendationId,
        feedbackType,
        subjectiveFatigue: params.subjectiveFatigue,
        pain: params.pain || false,
        painArea: params.painArea,
        availableTimeMinutes: params.availableTimeMinutes,
        preferredSport: params.preferredSport,
        note: params.note,
      },
    });
  }

  /**
   * 保存调整后的训练建议
   */
  private async saveAdjustedRecommendation(
    userId: string,
    original: any,
    adjustedWorkout: WorkoutRecommendation,
    feedbackType: FeedbackType,
  ) {
    // 将原建议标记为已调整
    await this.prisma.dailyRecommendation.update({
      where: { id: original.id },
      data: { status: 'adjusted' },
    });

    // 创建新的建议
    return this.prisma.dailyRecommendation.create({
      data: {
        userId,
        date: original.date,
        trainingCapacity: original.trainingCapacity,
        capacityStatus: original.capacityStatus,
        trainingRiskScore: original.trainingRiskScore,
        trainingRiskLevel: original.trainingRiskLevel,
        dataLevel: original.dataLevel,
        availableTimeMinutes: adjustedWorkout.durationMinutes,
        preferredSport: adjustedWorkout.sport,
        sport: adjustedWorkout.sport,
        type: adjustedWorkout.type,
        title: adjustedWorkout.title,
        durationMinutes: adjustedWorkout.durationMinutes,
        expectedTss: adjustedWorkout.expectedTss,
        intensity: adjustedWorkout.intensity,
        structure: adjustedWorkout.structure as any,
        dayType: original.dayType,
        hardSafetyTriggered: feedbackType === 'pain_or_discomfort',
        triggeredRules: [],
        evidence: original.evidence,
        userFriendlyReason: `根据你的反馈调整：${feedbackType}`,
        technicalReason: `Adjusted due to ${feedbackType}`,
        confidence: original.confidence * 0.9,
        status: 'active',
        originalRecommendationId: original.id,
        decisionJson: {
          ...original.decisionJson,
          adjustedFrom: original.id,
          adjustmentReason: feedbackType,
          adjustedAt: new Date().toISOString(),
        } as any,
      },
    });
  }
}
