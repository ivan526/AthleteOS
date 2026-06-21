import { Controller, Get, Post, Body, Logger, Query, Param } from '@nestjs/common';
import { DailyStateBuilderService } from '../athlete/daily-state-builder.service';
import { TrainingDecisionEngineService } from './training-decision-engine.service';
import { FeedbackType } from './types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CurrentUserService } from '../../shared/prisma/current-user.service';
import { LlmCoachService } from './llm-coach.service';

/**
 * 训练相关API控制器
 * 实现PRD第20节API规范
 */
@Controller('api')
export class TrainingController {
  private readonly logger = new Logger(TrainingController.name);

  constructor(
    private dailyStateBuilder: DailyStateBuilderService,
    private decisionEngine: TrainingDecisionEngineService,
    private prisma: PrismaService,
    private currentUser: CurrentUserService,
    private llmCoach: LlmCoachService,
  ) {}

  /**
   * 获取今日训练建议
   * PRD 20.1节
   */
  @Get('today')
  async getToday() {
    try {
      const userId = await this.currentUser.getUserId();
      const today = new Date();

      const state = await this.dailyStateBuilder.buildDailyState(userId, today);
      const decision = await this.decisionEngine.generateDailyDecision(userId, state, today);
      const savedRecommendation = await this.findRecommendationForDate(userId, today);
      const profile = await this.prisma.athleteProfile.findUnique({
        where: { userId },
        select: { primarySport: true, preferredSports: true },
      });
      const useSavedRecommendation = Boolean(
        savedRecommendation && ['adjusted', 'completed', 'skipped'].includes(savedRecommendation.status),
      );
      const effectiveRecommendation = useSavedRecommendation
        ? {
            sport: savedRecommendation!.sport,
            type: savedRecommendation!.type,
            title: savedRecommendation!.title,
            durationMinutes: savedRecommendation!.durationMinutes,
            expectedTss: savedRecommendation!.expectedTss,
            intensity: savedRecommendation!.intensity,
            structure: savedRecommendation!.structure as any,
          }
        : decision.recommendation;

      return {
        date: today.toISOString().split('T')[0],
        training_capacity: {
          score: state.trainingCapacity.score,
          status: state.trainingCapacity.status,
          confidence: state.confidence,
          data_quality: state.dataQuality.overall,
          confidence_label: this.getConfidenceLabel(state.confidence),
          trend_vs_yesterday: '+4', // TODO: 实现趋势计算
        },
        training_risk: {
          level: state.trainingRisk.level,
          label: state.trainingRisk.userLabel,
        },
        recommendation: {
          id: savedRecommendation?.id ?? '',
          sport: effectiveRecommendation.sport,
          type: effectiveRecommendation.type,
          title: effectiveRecommendation.title,
          duration_minutes: effectiveRecommendation.durationMinutes,
          expected_tss: effectiveRecommendation.expectedTss,
          intensity: effectiveRecommendation.intensity,
          structure: this.toApiStructure(effectiveRecommendation.structure),
        },
        sport_options: this.getSportOptions(
          profile?.primarySport,
          profile?.preferredSports,
        ),
        explanation: {
          simple: useSavedRecommendation
            ? savedRecommendation!.userFriendlyReason
            : decision.decision.userFriendlyReason,
          reasons: this.buildFriendlyReasons(state),
          ai_coach: {
            used_llm: Boolean(decision.decisionJson.aiCoach?.usedLlm),
            safety_filtered: Boolean(decision.decisionJson.aiCoach?.safetyFiltered),
            fallback_used: Boolean(decision.decisionJson.aiCoach?.fallbackUsed),
          },
          technical: {
            ctl: state.fitness,
            atl: state.fatigue,
            form: state.form,
            acwr: state.acwr?.acwr,
            monotony: state.monotony?.monotony,
            sleep_score: state.sleepScore ?? null,
            hrv_score: state.hrvScore ?? null,
            confidence: state.confidence,
            triggered_rules: state.hardSafety?.rules || [],
          },
        },
        feedback_options: [
          'too_tired',
          'not_enough_time',
          'pain_or_discomfort',
          'change_sport',
          'skip_today',
          'completed_as_planned',
        ],
        disclaimer: 'AthleteOS 提供训练建议仅供参考，不构成医疗建议。',
      };
    } catch (error) {
      this.logger.error('获取今日训练数据失败', error);
      throw error;
    }
  }

  /**
   * 提交用户反馈
   * PRD 20.2节
   */
  @Post('today/feedback')
  async submitFeedback(
    @Body()
    body: {
      recommendation_id: string;
      feedback_type: FeedbackType;
      subjective_fatigue?: number;
      pain?: boolean;
      available_time_minutes?: number;
      preferred_sport?: string;
      note?: string;
      pain_area?: string;
    },
  ) {
    const userId = await this.currentUser.getUserId();
    const recommendationId =
      body.recommendation_id || (await this.findRecommendationForDate(userId, new Date()))?.id;

    if (!recommendationId) {
      throw new Error('训练建议不存在');
    }

    const feedbackType = body.feedback_type || 'other';
    const result = await this.decisionEngine.adjustRecommendation(
      userId,
      recommendationId,
      feedbackType,
      {
        subjectiveFatigue: body.subjective_fatigue,
        pain: body.pain,
        painArea: body.pain_area,
        availableTimeMinutes: body.available_time_minutes,
        preferredSport: body.preferred_sport,
        note: body.note,
      },
    );

    if (body.subjective_fatigue != null) {
      const today = this.dateOnly(new Date());
      await this.prisma.dailyAthleteState.updateMany({
        where: { userId, date: today },
        data: { subjectiveFatigue: body.subjective_fatigue },
      });
    }

    return {
      adjusted: result.adjusted,
      new_recommendation: result.newRecommendation
        ? {
            id: recommendationId,
            sport: result.newRecommendation.sport,
            type: result.newRecommendation.type,
            title: result.newRecommendation.title,
            duration_minutes: result.newRecommendation.durationMinutes,
            expected_tss: result.newRecommendation.expectedTss,
            intensity: result.newRecommendation.intensity,
            structure: this.toApiStructure(result.newRecommendation.structure),
          }
        : undefined,
      reason: result.reason,
      decision: {
        confidence: result.decision.confidence,
        hard_safety_triggered: result.decision.hardSafetyTriggered,
        adjustment_reason: result.decision.adjustmentReason,
      },
    };
  }

  @Get('feedback')
  async getFeedbackHistory(@Query('limit') limit = '20') {
    const userId = await this.currentUser.getUserId();
    const take = Math.max(1, Math.min(Number(limit) || 20, 100));
    const feedback = await this.prisma.userFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        recommendation: {
          select: {
            date: true,
            title: true,
            type: true,
            durationMinutes: true,
            expectedTss: true,
            status: true,
          },
        },
      },
    });

    return feedback.map((item) => ({
      id: item.id,
      created_at: item.createdAt,
      date: item.recommendation.date.toISOString().slice(0, 10),
      feedback_type: item.feedbackType || 'other',
      subjective_fatigue: item.subjectiveFatigue,
      pain: item.pain,
      pain_area: item.painArea,
      available_time_minutes: item.availableTimeMinutes,
      preferred_sport: item.preferredSport,
      note: item.note,
      recommendation: {
        title: item.recommendation.title,
        type: item.recommendation.type,
        duration_minutes: item.recommendation.durationMinutes,
        expected_tss: item.recommendation.expectedTss,
        status: item.recommendation.status,
      },
    }));
  }

  /**
   * 获取历史活动列表
   */
  @Get('activities')
  async getActivities(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const userId = await this.currentUser.getUserId();
    const pageNumber = Number(page) || 1;
    const take = Math.min(Number(limit) || 30, 100);
    const skip = Math.max(pageNumber - 1, 0) * take;

    const activities = await this.prisma.activity.findMany({
      where: this.realActivityWhere(userId),
      orderBy: { startTime: 'desc' },
      skip,
      take,
    });

    return activities.map((activity) => this.toApiActivity(activity));
  }

  /**
   * 获取活动详情
   */
  @Get('activities/:id')
  async getActivityDetail(
    @Param('id') id: string,
  ) {
    const userId = await this.currentUser.getUserId();
    const activity = await this.prisma.activity.findFirst({
      where: this.realActivityWhere(userId, { id }),
    });

    if (!activity) {
      throw new Error('活动不存在');
    }

    const recentStart = new Date(activity.startTime);
    recentStart.setDate(recentStart.getDate() - 28);
    const recentSameSport = await this.prisma.activity.findMany({
      where: this.realActivityWhere(userId, {
        sport: activity.sport,
        startTime: {
          gte: recentStart,
          lt: activity.startTime,
        },
      }),
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    const presentation = this.toApiActivity(activity);
    const analysis = this.buildActivityAnalysis(activity, recentSameSport);
    const coach = await this.llmCoach.analyzeActivity({
      userId,
      fallbackText: analysis.fallbackText,
      evidence: {
        activity: presentation,
        advanced_metrics: analysis.metrics,
        training_effect: analysis.trainingEffect,
        benefits: analysis.benefits,
        cautions: analysis.cautions,
        recovery: analysis.recovery,
        comparison: analysis.comparison,
        sources: analysis.sources,
      },
      ruleResult: {
        load_level: analysis.loadLevel,
        data_quality: analysis.dataQuality,
      },
    });

    return {
      ...presentation,
      advancedMetrics: analysis.metrics,
      dataSources: analysis.sources,
      coachReview: {
        summary: coach.text,
        trainingEffect: analysis.trainingEffect,
        benefits: analysis.benefits,
        cautions: analysis.cautions,
        recovery: analysis.recovery,
        comparison: analysis.comparison,
        dataQuality: analysis.dataQuality,
        usedLlm: coach.usedLlm,
        safetyFiltered: coach.safetyFiltered,
        fallbackUsed: coach.fallbackUsed,
      },
    };
  }

  /**
   * 获取周复盘数据
   */
  @Get('weekly-review')
  async getWeeklyReview(
    @Query('weekOffset') weekOffset = '0',
  ) {
    const userId = await this.currentUser.getUserId();
    const offset = Number(weekOffset) || 0;
    // 计算周的起止日期（周一到周日）
    const baseDate = new Date();
    const currentDay = baseDate.getDay();
    const monday = new Date(baseDate);
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    monday.setDate(baseDate.getDate() - daysFromMonday - offset * 7);
    monday.setHours(0, 0, 0, 0);

    const weekStart = new Date(monday);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const formatDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const activities = await this.prisma.activity.findMany({
      where: this.realActivityWhere(userId, {
        startTime: {
          gte: weekStart,
          lte: weekEnd,
        },
      }),
      orderBy: { startTime: 'asc' },
    });

    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(weekStart.getDate() - 7);
    const previousWeekEnd = new Date(weekEnd);
    previousWeekEnd.setDate(weekEnd.getDate() - 7);
    const previousActivities = await this.prisma.activity.findMany({
      where: this.realActivityWhere(userId, {
        startTime: {
          gte: previousWeekStart,
          lte: previousWeekEnd,
        },
      }),
    });

    const weeklyTss = Math.round(activities.reduce((sum, activity) => sum + (activity.tss || 0), 0));
    const previousTss = previousActivities.reduce((sum, activity) => sum + (activity.tss || 0), 0);
    const loadChangeVsLastWeek = previousTss > 0 ? (weeklyTss - previousTss) / previousTss : 0;
    const trainingDays = new Set(activities.map((activity) => activity.startTime.toISOString().split('T')[0])).size;
    const adherence = Math.min(trainingDays / 6, 1);
    const riskLevel = loadChangeVsLastWeek > 0.2 ? 'moderate' : 'low';

    const report = {
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      summary: weeklyTss > 0 ? '本周训练完成度较好，负荷增长稳定。' : '本周暂无训练记录，建议从轻松训练恢复节奏。',
      adherence,
      weeklyTss,
      loadChangeVsLastWeek,
      trainingRiskLevel: riskLevel,
      highlights: [
        `完成 ${trainingDays} 次训练`,
        `周训练负荷 TSS ${weeklyTss}`,
        Math.abs(loadChangeVsLastWeek) < 0.1 ? '周负荷增长处于合理范围' : `较上周 ${loadChangeVsLastWeek > 0 ? '增加' : '下降'} ${Math.abs(Math.round(loadChangeVsLastWeek * 100))}%`,
      ],
      warnings: loadChangeVsLastWeek > 0.15
        ? ['周末连续两天强度偏高']
        : ['保持当前训练节奏，注意睡眠和补给'],
      nextWeekRecommendation: loadChangeVsLastWeek > 0.15
        ? '下周建议控制高强度次数。'
        : '下周可以维持当前训练量。',
      dailyStats: this.buildWeeklyDailyStats(weekStart, activities),
    };
    const analysisContext = await this.buildTrainingAnalysisContext(userId, weekStart, weekEnd);
    const aiCoachSummary = await this.llmCoach.summarizeTrainingAnalysis({
      userId,
      fallbackText: `${report.summary}${report.nextWeekRecommendation}`,
      evidence: {
        weeklyReport: report,
        modelCoverage: analysisContext.modelCoverage,
        recoveryTrend: analysisContext.recoveryTrend,
      },
      ruleResult: {
        trainingRiskLevel: riskLevel,
        nextWeekRecommendation: report.nextWeekRecommendation,
      },
    });

    return {
      ...report,
      aiCoachSummary: aiCoachSummary.text,
      aiCoach: {
        usedLlm: aiCoachSummary.usedLlm,
        safetyFiltered: aiCoachSummary.safetyFiltered,
        fallbackUsed: aiCoachSummary.fallbackUsed,
      },
      modelCoverage: analysisContext.modelCoverage,
      recoveryTrend: analysisContext.recoveryTrend,
    };
  }

  @Get('weekly-review/latest')
  async getLatestWeeklyReview() {
    return this.getWeeklyReview('0');
  }

  @Post('ai-coach/ask')
  async askAiCoach(
    @Body()
    body: {
      question: string;
      pain?: boolean;
    },
  ) {
    const userId = await this.currentUser.getUserId();
    const question = body.question?.trim();
    if (!question) {
      throw new Error('请输入问题');
    }

    const state = await this.dailyStateBuilder.buildDailyState(userId, new Date());
    const fallbackText = `当前 Training Capacity 为 ${state.trainingCapacity.score}，训练风险为 ${state.trainingRisk.userLabel}。AI Coach 只能解释现有数据和规则结果，不会改变训练负荷。`;
    const result = await this.llmCoach.answerQuestion({
      userId,
      question,
      fallbackText,
      evidence: {
        trainingCapacity: state.trainingCapacity,
        trainingRisk: state.trainingRisk,
        sleepScore: state.sleepScore,
        hrvScore: state.hrvScore,
        form: state.form,
        acwr: state.acwr,
        monotony: state.monotony,
        dataLevel: state.dataLevel,
        dataQuality: state.dataQuality,
      },
      ruleResult: {
        hardSafety: state.hardSafety,
      },
      hardSafetyTriggered: state.hardSafety?.triggered || false,
      painReported: Boolean(body.pain),
    });

    return {
      answer: result.text,
      used_llm: result.usedLlm,
      safety_filtered: result.safetyFiltered,
      fallback_used: result.fallbackUsed,
    };
  }

  @Get('ai-coach/audits')
  async getAiCoachAudits(@Query('limit') limit = '20') {
    const userId = await this.currentUser.getUserId();
    const take = Math.max(1, Math.min(Number(limit) || 20, 100));
    return this.prisma.aiCoachAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        interactionType: true,
        provider: true,
        model: true,
        inputEvidence: true,
        ruleResult: true,
        rawOutput: true,
        finalOutput: true,
        guardrailReasons: true,
        safetyFiltered: true,
        fallbackUsed: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  }

  @Get('history/summary')
  async getHistorySummary() {
    const userId = await this.currentUser.getUserId();
    const now = new Date();
    const currentWeekStart = this.startOfWeek(now);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    const currentActivities = await this.prisma.activity.findMany({
      where: this.realActivityWhere(userId, {
        startTime: { gte: currentWeekStart, lte: currentWeekEnd },
      }),
    });

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekEnd);
    previousWeekEnd.setDate(currentWeekEnd.getDate() - 7);
    const previousActivities = await this.prisma.activity.findMany({
      where: this.realActivityWhere(userId, {
        startTime: { gte: previousWeekStart, lte: previousWeekEnd },
      }),
    });

    const weeklyTss = Math.round(currentActivities.reduce((sum, activity) => sum + (activity.tss || 0), 0));
    const previousTss = previousActivities.reduce((sum, activity) => sum + (activity.tss || 0), 0);
    const loadChangeVsLastWeek = previousTss > 0 ? (weeklyTss - previousTss) / previousTss : 0;
    const trainingDays = new Set(currentActivities.map((activity) => activity.startTime.toISOString().split('T')[0])).size;
    const averageTss = trainingDays ? weeklyTss / trainingDays : 0;

    return {
      weekStart: this.formatDate(currentWeekStart),
      weekEnd: this.formatDate(currentWeekEnd),
      weeklyTss,
      loadChangeVsLastWeek,
      trainingDays,
      plannedDays: 6,
      adherence: Math.min(trainingDays / 6, 1),
      averageIntensity: averageTss >= 65 ? '高强度' : averageTss >= 40 ? '中等' : averageTss > 0 ? '低强度' : '无训练',
      trainingRiskLevel: loadChangeVsLastWeek > 0.2 ? 'moderate' : 'low',
      fourWeekTrend: await this.buildFourWeekTrend(userId, currentWeekStart),
    };
  }

  @Get('model/data-coverage')
  async getModelDataCoverage() {
    const userId = await this.currentUser.getUserId();
    const since = new Date();
    since.setDate(since.getDate() - 180);
    const [activities, wellness, wellnessMetrics] = await Promise.all([
      this.prisma.activity.findMany({
        where: this.realActivityWhere(userId),
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.dailyAthleteState.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 180,
      }),
      this.prisma.dailyWellnessMetric.findMany({
        where: {
          userId,
          date: { gte: since },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    const sleepDays = this.countMetricDays(wellnessMetrics, (metric) => metric.sleepScore != null);
    const sleepDurationDays = this.countMetricDays(wellnessMetrics, (metric) => metric.sleepSeconds != null);
    const hrvDays = this.countMetricDays(
      wellnessMetrics,
      (metric) => metric.hrvScore != null || metric.hrvMs != null || metric.hrvSdnnMs != null,
    );
    const ctlAtlDays = wellness.filter((state) => state.fitness != null && state.fatigue != null).length;
    const subjectiveDays = wellness.filter((state) => state.subjectiveFatigue != null).length;
    const earliestActivity = activities[0]?.startTime;
    const historyDays = earliestActivity
      ? Math.ceil((Date.now() - earliestActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const available = [
      { key: 'activities', label: '训练记录', count: activities.length, source: 'Garmin 中国区 + Intervals.icu 统一活动' },
      { key: 'ctl_atl_form', label: 'CTL / ATL / Form', count: ctlAtlDays, source: 'AthleteOS 根据统一活动负荷计算' },
      { key: 'sleep', label: '睡眠评分', count: sleepDays, source: 'DailyWellnessMetric.sleepScore' },
      { key: 'sleep_duration', label: '睡眠时长', count: sleepDurationDays, source: 'DailyWellnessMetric.sleepSeconds' },
      { key: 'hrv', label: 'HRV', count: hrvDays, source: 'Garmin 中国区优先，Intervals.icu 补充' },
    ];

    const missing = [
      subjectiveDays === 0 ? '主观疲劳/酸痛/压力反馈需要用户在反馈弹窗或每日状态中补充' : null,
      hrvDays === 0 ? '当前账号最近 180 天没有可用 HRV 数据，模型会使用睡眠、静息心率和训练负荷替代，不伪造 HRV' : null,
      sleepDays === 0 ? '当前账号最近 180 天没有可用睡眠评分，模型会降低睡眠维度置信度' : null,
      '训练计划/目标阶段仍来自本地偏好，尚未接入外部训练计划日历',
      '分段/lap 明细尚未落库，活动详情只展示活动级指标',
    ].filter(Boolean);

    return {
      dataLevel: historyDays >= 90 ? 'A' : historyDays >= 42 ? 'B' : historyDays >= 14 ? 'C' : 'D',
      historyDays,
      available,
      missing,
      confidenceNote: missing.length ? '缺失维度会降低对应模型权重置信度，不会伪造数据。' : '核心模型数据覆盖良好。',
    };
  }

  @Get('wellness/history')
  async getWellnessHistory(@Query('days') days = '30') {
    const userId = await this.currentUser.getUserId();
    const daysNumber = Math.max(1, Math.min(Number(days) || 30, 365));
    const since = this.dateOnly(new Date());
    since.setDate(since.getDate() - daysNumber + 1);

    const metrics = await this.prisma.dailyWellnessMetric.findMany({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: [
        { date: 'desc' },
        { source: 'asc' },
      ],
    });

    return metrics.map((metric) => ({
      date: this.formatDate(metric.date),
      source: metric.source,
      sleep_score: metric.sleepScore,
      sleep_seconds: metric.sleepSeconds,
      sleep_hours: metric.sleepSeconds != null ? Number((metric.sleepSeconds / 3600).toFixed(2)) : null,
      sleep_quality: metric.sleepQuality,
      hrv_score: metric.hrvScore,
      hrv_ms: metric.hrvMs,
      hrv_sdnn_ms: metric.hrvSdnnMs,
      resting_hr: metric.restingHr,
      readiness: metric.readiness,
      fatigue: metric.fatigue,
      soreness: metric.soreness,
      stress: metric.stress,
      mood: metric.mood,
      motivation: metric.motivation,
      weight_kg: metric.weightKg,
      steps: metric.steps,
    }));
  }

  @Get('state/daily')
  async getDailyState(@Query('date') date?: string) {
    const userId = await this.currentUser.getUserId();
    const targetDate = this.dateOnly(date ? new Date(date) : new Date());
    const state = await this.prisma.dailyAthleteState.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });

    return state || { date: targetDate.toISOString().split('T')[0], subjectiveFatigue: null };
  }

  @Post('state/daily')
  async updateDailyState(
    @Body()
    body: {
      date?: string;
      subjective_fatigue?: number;
      sleep_score?: number;
      hrv_score?: number;
      note?: string;
    },
  ) {
    const userId = await this.currentUser.getUserId();
    const targetDate = this.dateOnly(body.date ? new Date(body.date) : new Date());
    const latestState = await this.dailyStateBuilder.buildDailyState(userId, targetDate);

    return this.prisma.dailyAthleteState.update({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      data: {
        subjectiveFatigue: body.subjective_fatigue,
        sleepScore: body.sleep_score,
        hrvScore: body.hrv_score,
        stateJson: {
          ...latestState,
          manualNote: body.note,
          manualUpdatedAt: new Date().toISOString(),
        } as any,
      },
    });
  }

  /**
   * 获取强度标签
   */
  private getIntensityLabel(tss: number): string {
    if (tss < 30) return '低强度';
    if (tss < 60) return '中等强度';
    return '高强度';
  }

  /**
   * 获取置信度标签
   * 参考PRD第1369-1372行
   */
  private getConfidenceLabel(confidence: number): string {
    if (confidence > 0.8) return '建议可信度较高';
    if (confidence > 0.6) return '建议可信度中等';
    if (confidence > 0.4) return '建议仅供参考';
    return '数据不足，建议谨慎参考';
  }

  private getSportOptions(
    primarySport?: string | null,
    preferredSports?: unknown,
  ) {
    const supported = ['running', 'cycling', 'swimming', 'strength'];
    const preferred = Array.isArray(preferredSports)
      ? preferredSports.filter(
          (sport): sport is string =>
            typeof sport === 'string' && supported.includes(sport),
        )
      : [];
    const fallback =
      primarySport && supported.includes(primarySport) ? primarySport : 'running';
    const ordered = preferred.length > 0 ? preferred : [fallback];

    return [...new Set(ordered)].map((sport) => ({
      sport,
      label: this.getSportLabel(sport),
    }));
  }

  private async findRecommendationForDate(userId: string, date: Date) {
    return this.prisma.dailyRecommendation.findUnique({
      where: {
        userId_date: {
          userId,
          date: this.dateOnly(date),
        },
      },
    });
  }

  private dateOnly(date: Date) {
    return new Date(date.toISOString().split('T')[0]);
  }

  private toApiStructure(structure: any) {
    return {
      warmup: structure?.warmup,
      main_set: structure?.main_set ?? structure?.mainSet ?? '按照计划完成训练',
      cooldown: structure?.cooldown,
    };
  }

  private buildFriendlyReasons(state: any): string[] {
    const reasons = ['近期训练负荷稳定'];
    if ((state.sleepScore ?? 75) >= 70) reasons.unshift('睡眠恢复较好');
    if ((state.trainingRisk?.score ?? 0.3) < 0.5) reasons.push('当前疲劳处于可接受范围');
    if (state.hardSafety?.triggered) reasons.push('安全规则已限制训练强度');
    return reasons.slice(0, 3);
  }

  private buildActivityAnalysis(activity: any, recentSameSport: any[]) {
    const raw = (activity.rawData as Record<string, any> | null) ?? {};
    const metrics: Array<{
      key: string;
      group: string;
      label: string;
      value: string;
      note?: string;
    }> = [];
    const addMetric = (
      key: string,
      group: string,
      label: string,
      value: string | number | null | undefined,
      unit = '',
      note?: string,
    ) => {
      if (value === null || value === undefined || value === '') return;
      metrics.push({
        key,
        group,
        label,
        value: `${value}${unit}`,
        ...(note ? { note } : {}),
      });
    };

    const durationHours = Math.max(activity.durationSeconds, 1) / 3600;
    const distanceKm = (activity.distanceMeters ?? 0) / 1000;
    const averageSpeedMps =
      raw.avg_speed ??
      raw.average_speed ??
      (activity.distanceMeters
        ? activity.distanceMeters / Math.max(activity.durationSeconds, 1)
        : null);
    const averageSpeedKmh =
      averageSpeedMps != null ? averageSpeedMps * 3.6 : null;
    const maxSpeedMps = raw.max_speed;
    const cadence = raw.average_cadence;
    const calories = raw.calories;
    const aerobicEffect =
      raw.aerobicTrainingEffect ?? raw.sources?.['garmin.cn']?.aerobicTrainingEffect;
    const anaerobicEffect =
      raw.anaerobicTrainingEffect ?? raw.sources?.['garmin.cn']?.anaerobicTrainingEffect;
    const garminLoad =
      raw.garmin_training_load ??
      raw.activityTrainingLoad ??
      raw.sources?.['garmin.cn']?.activityTrainingLoad;
    const workKj =
      activity.avgPower != null
        ? (activity.avgPower * activity.durationSeconds) / 1000
        : null;
    const variabilityIndex =
      activity.normalizedPower != null && activity.avgPower
        ? activity.normalizedPower / activity.avgPower
        : null;
    const elevationPerKm =
      activity.elevationGain != null && distanceKm > 0
        ? activity.elevationGain / distanceKm
        : null;
    const caloriesPerHour =
      calories != null ? calories / durationHours : null;

    addMetric('tss', '训练负荷', 'TSS', Math.round(activity.tss ?? 0), '', '统一活动负荷');
    addMetric(
      'garmin_load',
      '训练负荷',
      'Garmin 训练负荷',
      garminLoad != null ? Math.round(garminLoad) : null,
    );
    addMetric(
      'if',
      '训练负荷',
      '强度因子 IF',
      activity.intensityFactor != null
        ? activity.intensityFactor.toFixed(2)
        : null,
    );
    addMetric(
      'aerobic_effect',
      '训练效果',
      '有氧训练效果',
      aerobicEffect != null ? Number(aerobicEffect).toFixed(1) : null,
      '',
      this.trainingEffectLabel(aerobicEffect),
    );
    addMetric(
      'anaerobic_effect',
      '训练效果',
      '无氧训练效果',
      anaerobicEffect != null ? Number(anaerobicEffect).toFixed(1) : null,
      '',
      this.trainingEffectLabel(anaerobicEffect),
    );
    addMetric(
      'hr_range',
      '心肺',
      '心率跨度',
      activity.avgHr != null && activity.maxHr != null
        ? Math.round(activity.maxHr - activity.avgHr)
        : null,
      ' bpm',
      activity.avgHr != null && activity.maxHr != null
        ? `平均 ${Math.round(activity.avgHr)} / 最高 ${Math.round(activity.maxHr)}`
        : undefined,
    );
    addMetric(
      'cadence',
      '技术',
      activity.sport === 'cycling' ? '平均踏频' : '平均步频',
      cadence != null ? Math.round(cadence) : null,
      activity.sport === 'cycling' ? ' rpm' : ' spm',
    );
    addMetric(
      'elevation_density',
      '地形',
      '每公里爬升',
      elevationPerKm != null ? elevationPerKm.toFixed(1) : null,
      ' m/km',
    );
    addMetric(
      'energy_rate',
      '能量',
      '小时能耗',
      caloriesPerHour != null ? Math.round(caloriesPerHour) : null,
      ' kcal/h',
    );

    if (activity.sport === 'cycling') {
      addMetric(
        'average_speed',
        '骑行效率',
        '平均速度',
        averageSpeedKmh != null ? averageSpeedKmh.toFixed(1) : null,
        ' km/h',
      );
      addMetric(
        'max_speed',
        '骑行效率',
        '最高速度',
        maxSpeedMps != null ? (maxSpeedMps * 3.6).toFixed(1) : null,
        ' km/h',
      );
      addMetric('work', '功率', '机械功', workKj != null ? Math.round(workKj) : null, ' kJ');
      addMetric(
        'variability_index',
        '功率',
        '功率变异指数 VI',
        variabilityIndex != null ? variabilityIndex.toFixed(2) : null,
        '',
        variabilityIndex != null
          ? variabilityIndex <= 1.05
            ? '输出较稳定'
            : '功率波动较明显'
          : undefined,
      );
      addMetric(
        'power_hr_efficiency',
        '骑行效率',
        '功率心率效率',
        activity.avgPower && activity.avgHr
          ? (activity.avgPower / activity.avgHr).toFixed(2)
          : null,
        ' W/bpm',
      );
    } else if (activity.sport === 'running') {
      addMetric(
        'pace',
        '跑步效率',
        '平均配速',
        activity.avgPace ? this.formatPace(activity.avgPace) : null,
      );
      addMetric(
        'running_power',
        '跑步功率',
        '平均跑步功率',
        activity.avgPower != null ? Math.round(activity.avgPower) : null,
        ' W',
      );
      addMetric(
        'running_normalized_power',
        '跑步功率',
        '标准化跑步功率',
        activity.normalizedPower != null
          ? Math.round(activity.normalizedPower)
          : null,
        ' W',
      );
      addMetric(
        'running_power_variability',
        '跑步功率',
        '功率波动 NP/Avg',
        variabilityIndex != null ? variabilityIndex.toFixed(2) : null,
        '',
        variabilityIndex != null
          ? variabilityIndex <= 1.08
            ? '输出较稳定'
            : '受配速或地形变化影响较明显'
          : undefined,
      );
      addMetric(
        'speed_hr_efficiency',
        '跑步效率',
        '速度心率效率',
        averageSpeedKmh && activity.avgHr
          ? (averageSpeedKmh / activity.avgHr).toFixed(3)
          : null,
        ' km/h/bpm',
      );
      addMetric(
        'stride_frequency',
        '跑步技术',
        '每分钟总步数',
        cadence != null ? Math.round(cadence) : null,
        ' spm',
      );
    }

    const averageRecentTss = recentSameSport.length
      ? recentSameSport.reduce((sum, item) => sum + (item.tss ?? 0), 0) /
        recentSameSport.length
      : null;
    const comparison =
      averageRecentTss != null && averageRecentTss > 0
        ? activity.tss >= averageRecentTss * 1.25
          ? `本次负荷比近 28 天同项目平均值高 ${Math.round(
              ((activity.tss - averageRecentTss) / averageRecentTss) * 100,
            )}%`
          : activity.tss <= averageRecentTss * 0.75
            ? `本次负荷比近 28 天同项目平均值低 ${Math.round(
                ((averageRecentTss - activity.tss) / averageRecentTss) * 100,
              )}%`
            : '本次负荷接近近 28 天同项目平均水平'
        : '同项目历史样本不足，暂不做趋势比较';

    const loadLevel =
      activity.tss >= 100 ? 'very_high' : activity.tss >= 70 ? 'high' : activity.tss >= 35 ? 'moderate' : 'low';
    const trainingEffect = this.activityTrainingEffect(
      activity.sport,
      aerobicEffect,
      anaerobicEffect,
      loadLevel,
    );
    const benefits = this.activityBenefits(
      activity.sport,
      aerobicEffect,
      anaerobicEffect,
      activity.intensityFactor,
    );
    const cautions: string[] = [];
    if (activity.tss >= 100) cautions.push('单次负荷较高，后续 24–48 小时应避免连续安排同类高强度训练。');
    if (activity.intensityFactor >= 0.9) cautions.push('强度因子较高，恢复不足时不宜立即叠加阈值或冲刺训练。');
    if (aerobicEffect >= 4.5) cautions.push('有氧刺激接近过度区间，注意补充能量、睡眠与低强度恢复。');
    if (activity.sport === 'cycling' && activity.avgPower == null) {
      cautions.push('本次缺少功率数据，强度评价主要依据心率、速度和训练负荷。');
    }
    if (cautions.length === 0) cautions.push('未发现明显异常负荷信号，仍应结合主观疲劳和疼痛反馈调整后续训练。');

    const recovery =
      activity.tss >= 100
        ? ['优先补充碳水和水分。', '次日以休息、步行或短时恢复训练为主。', '关注睡眠、HRV 与腿部酸痛变化。']
        : activity.tss >= 60
          ? ['训练后补充水分和正常正餐。', '次日可安排轻松有氧或技术训练。', '如果疲劳明显，减少下一次训练时长。']
          : ['保持正常补水和饮食。', '可按计划继续训练，但避免突然提高强度。'];
    const sources = Object.keys(raw.providerIds ?? raw.sources ?? {}).map((source) =>
      source === 'garmin.cn' ? 'Garmin 中国区' : source === 'intervals.icu' ? 'Intervals.icu' : source,
    );
    const dataQuality =
      metrics.length >= 9 && sources.length >= 2
        ? 'high'
        : metrics.length >= 6
          ? 'medium'
          : 'limited';
    const fallbackText = [
      `这次${this.getSportLabel(activity.sport)}形成了${trainingEffect}。`,
      benefits[0],
      comparison,
      cautions[0],
      recovery[0],
    ].join(' ');

    return {
      metrics,
      trainingEffect,
      benefits,
      cautions,
      recovery,
      comparison,
      sources,
      dataQuality,
      loadLevel,
      fallbackText,
    };
  }

  private activityTrainingEffect(
    sport: string,
    aerobicEffect?: number,
    anaerobicEffect?: number,
    loadLevel?: string,
  ): string {
    if ((anaerobicEffect ?? 0) >= 3.5) return '明显的无氧与高强度刺激';
    if ((aerobicEffect ?? 0) >= 4) return '较强的有氧能力与阈值刺激';
    if ((aerobicEffect ?? 0) >= 3) return '有效的有氧耐力提升刺激';
    if (loadLevel === 'low') return sport === 'cycling' ? '低负荷恢复与骑行技术刺激' : '低负荷恢复与跑步经济性刺激';
    return '中等强度的基础耐力刺激';
  }

  private activityBenefits(
    sport: string,
    aerobicEffect?: number,
    anaerobicEffect?: number,
    intensityFactor?: number,
  ): string[] {
    const benefits = sport === 'cycling'
      ? ['有助于提升持续踩踏能力和下肢有氧耐力。']
      : sport === 'running'
        ? ['有助于提升跑步有氧耐力和配速维持能力。']
        : ['有助于积累专项训练量和基础体能。'];
    if ((aerobicEffect ?? 0) >= 3) benefits.push('本次刺激足以促进心肺适应，但需要恢复后才能充分吸收。');
    if ((anaerobicEffect ?? 0) >= 2.5) benefits.push('包含一定无氧刺激，有助于改善短时高输出和速度变化能力。');
    if ((intensityFactor ?? 0) >= 0.8) benefits.push('整体强度较集中，对专项耐力和抗疲劳能力有积极作用。');
    return benefits;
  }

  private trainingEffectLabel(value?: number): string | undefined {
    if (value == null) return undefined;
    if (value >= 5) return '刺激过强';
    if (value >= 4) return '高度提升';
    if (value >= 3) return '有效提升';
    if (value >= 2) return '维持能力';
    return '轻微刺激';
  }

  private toApiActivity(activity: any) {
    const distanceKm = activity.distanceMeters ? activity.distanceMeters / 1000 : 0;
    const pace = activity.sport === 'running' && activity.avgPace
      ? this.formatPace(activity.avgPace)
      : undefined;
    const rawAverageSpeed = activity.rawData?.avg_speed ?? activity.rawData?.average_speed;
    const averageSpeedMps = rawAverageSpeed ?? (
      activity.distanceMeters && activity.durationSeconds
        ? activity.distanceMeters / activity.durationSeconds
        : undefined
    );
    const maxSpeedMps = activity.rawData?.max_speed;

    return {
      id: activity.id,
      date: activity.startTime.toISOString().split('T')[0],
      type: this.getSportLabel(activity.sport),
      sport: activity.sport,
      name: this.getActivityName(activity.sport, activity.tss || 0, activity.rawData?.name),
      duration: `${Math.round(activity.durationSeconds / 60)} 分钟`,
      durationSeconds: activity.durationSeconds,
      distance: distanceKm ? `${distanceKm.toFixed(1)} km` : '-',
      distanceMeters: activity.distanceMeters,
      tss: Math.round(activity.tss || 0),
      intensity: this.getIntensityLabel(activity.tss || 0),
      avgPace: pace,
      avgSpeedKmh: averageSpeedMps ? Number((averageSpeedMps * 3.6).toFixed(1)) : undefined,
      maxSpeedKmh: maxSpeedMps ? Number((maxSpeedMps * 3.6).toFixed(1)) : undefined,
      avgHr: activity.avgHr ? Math.round(activity.avgHr) : undefined,
      maxHr: activity.maxHr ? Math.round(activity.maxHr) : undefined,
      avgCadence: activity.rawData?.average_cadence ? Math.round(activity.rawData.average_cadence) : undefined,
      avgPower: activity.avgPower ? Math.round(activity.avgPower) : undefined,
      normalizedPower: activity.normalizedPower ? Math.round(activity.normalizedPower) : undefined,
      intensityFactor: activity.intensityFactor
        ? Number(activity.intensityFactor.toFixed(2))
        : undefined,
      calories: activity.rawData?.calories ? Math.round(activity.rawData.calories) : undefined,
      elevationGain: activity.elevationGain ? `${Math.round(activity.elevationGain)} m` : undefined,
    };
  }

  private getSportLabel(sport: string) {
    const labels: Record<string, string> = {
      running: '跑步',
      cycling: '骑行',
      swimming: '游泳',
      strength: '力量训练',
      mobility: '灵活性',
      other: '其他',
    };
    return labels[sport] || sport;
  }

  private getActivityName(sport: string, tss: number, sourceName?: string) {
    if (sourceName?.trim()) return sourceName.trim();
    if (sport === 'cycling') return '骑行';
    if (sport === 'running') return tss > 75 ? '长距离跑' : tss > 55 ? '节奏跑' : '轻松跑';
    return '训练';
  }

  private formatPace(secondsPerKm: number) {
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.round(secondsPerKm % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
  }

  private buildWeeklyDailyStats(weekStart: Date, activities: any[]) {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dateKey = date.toISOString().split('T')[0];
      const tss = activities
        .filter((activity) => activity.startTime.toISOString().split('T')[0] === dateKey)
        .reduce((sum, activity) => sum + (activity.tss || 0), 0);

      return {
        date: `${date.getMonth() + 1}月${date.getDate()}日`,
        tss: Math.round(tss),
        type: tss > 0 ? 'training' : 'rest',
      };
    });
  }

  private startOfWeek(date: Date) {
    const start = new Date(date);
    const currentDay = start.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    start.setDate(start.getDate() - daysFromMonday);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private formatDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private async buildFourWeekTrend(userId: string, currentWeekStart: Date) {
    const trend: Array<{ week: string; tss: number; change: string }> = [];

    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(weekStart.getDate() - 7);
      const previousWeekEnd = new Date(weekEnd);
      previousWeekEnd.setDate(weekEnd.getDate() - 7);

      const [activities, previousActivities] = await Promise.all([
        this.prisma.activity.findMany({
          where: this.realActivityWhere(userId, {
            startTime: { gte: weekStart, lte: weekEnd },
          }),
        }),
        this.prisma.activity.findMany({
          where: this.realActivityWhere(userId, {
            startTime: { gte: previousWeekStart, lte: previousWeekEnd },
          }),
        }),
      ]);

      const tss = Math.round(activities.reduce((sum, activity) => sum + (activity.tss || 0), 0));
      const previousTss = previousActivities.reduce((sum, activity) => sum + (activity.tss || 0), 0);
      const change = previousTss > 0 ? Math.round(((tss - previousTss) / previousTss) * 100) : 0;

      trend.push({
        week: `第${this.getWeekNumber(weekStart)}周`,
        tss,
        change: `${change >= 0 ? '+' : ''}${change}%`,
      });
    }

    return trend;
  }

  private getWeekNumber(date: Date) {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
    return Math.ceil((days + firstDay.getDay() + 1) / 7);
  }

  private realActivityWhere(userId: string, extra: Record<string, any> = {}) {
    return {
      ...extra,
      connectedAccount: { userId },
      providerActivityId: { not: { startsWith: 'demo-' } },
    };
  }

  private countMetricDays<T extends { date: Date }>(metrics: T[], predicate: (metric: T) => boolean) {
    return new Set(
      metrics
        .filter(predicate)
        .map((metric) => this.formatDate(metric.date)),
    ).size;
  }

  private async buildTrainingAnalysisContext(userId: string, weekStart: Date, weekEnd: Date) {
    const [activityCount, recentStates, wellnessMetrics] = await Promise.all([
      this.prisma.activity.count({
        where: this.realActivityWhere(userId),
      }),
      this.prisma.dailyAthleteState.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 180,
      }),
      this.prisma.dailyWellnessMetric.findMany({
        where: {
          userId,
          date: { gte: weekStart, lte: weekEnd },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const sleepScores = wellnessMetrics
      .map((metric) => metric.sleepScore)
      .filter((value): value is number => value != null);
    const restingHrs = wellnessMetrics
      .map((metric) => metric.restingHr)
      .filter((value): value is number => value != null);
    const hrvValues = wellnessMetrics
      .map((metric) => metric.hrvMs ?? metric.hrvSdnnMs)
      .filter((value): value is number => value != null);
    const sleepDays = this.countMetricDays(wellnessMetrics, (metric) => metric.sleepScore != null);
    const hrvDays = this.countMetricDays(
      wellnessMetrics,
      (metric) => metric.hrvScore != null || metric.hrvMs != null || metric.hrvSdnnMs != null,
    );

    return {
      modelCoverage: {
        activityCount,
        dailyStateDays: recentStates.length,
        sleepDays,
        hrvDays,
        hasCtlAtl: recentStates.some((state) => state.fitness != null && state.fatigue != null),
      },
      recoveryTrend: {
        averageSleepScore: this.average(sleepScores),
        averageRestingHr: this.average(restingHrs),
        hrvDataPoints: hrvValues.length,
        hrvDirection: this.direction(hrvValues),
        sleepDirection: this.direction(sleepScores),
      },
    };
  }

  private average(values: number[]): number | null {
    if (!values.length) return null;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  }

  private direction(values: number[]): 'up' | 'down' | 'stable' | 'insufficient' {
    if (values.length < 3) return 'insufficient';
    const midpoint = Math.floor(values.length / 2);
    const first = this.average(values.slice(0, midpoint));
    const second = this.average(values.slice(midpoint));
    if (first == null || second == null) return 'insufficient';
    const change = second - first;
    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'up' : 'down';
  }
}
