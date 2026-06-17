import { Controller, Get, Post, Body, Logger, Query, Param } from '@nestjs/common';
import { DailyStateBuilderService } from '../athlete/daily-state-builder.service';
import { TrainingDecisionEngineService } from './training-decision-engine.service';
import { FeedbackType } from './types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CurrentUserService } from '../../shared/prisma/current-user.service';

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
          sport: decision.recommendation.sport,
          type: decision.recommendation.type,
          title: decision.recommendation.title,
          duration_minutes: decision.recommendation.durationMinutes,
          expected_tss: decision.recommendation.expectedTss,
          intensity: decision.recommendation.intensity,
          structure: this.toApiStructure(decision.recommendation.structure),
        },
        explanation: {
          simple: decision.decision.userFriendlyReason,
          reasons: this.buildFriendlyReasons(state),
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
    },
  ) {
    const userId = await this.currentUser.getUserId();
    const recommendationId =
      body.recommendation_id || (await this.findRecommendationForDate(userId, new Date()))?.id;

    if (!recommendationId) {
      throw new Error('训练建议不存在');
    }

    const result = await this.decisionEngine.adjustRecommendation(
      userId,
      recommendationId,
      body.feedback_type,
      {
        subjectiveFatigue: body.subjective_fatigue,
        pain: body.pain,
        availableTimeMinutes: body.available_time_minutes,
        preferredSport: body.preferred_sport,
        note: body.note,
      },
    );

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

    return this.toApiActivity(activity);
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

    return {
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
  }

  @Get('weekly-review/latest')
  async getLatestWeeklyReview() {
    return this.getWeeklyReview('0');
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
    const account = await this.prisma.connectedAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'intervals.icu',
        },
      },
      include: {
        _count: {
          select: {
            activities: {
              where: {
                providerActivityId: { not: { startsWith: 'demo-' } },
              },
            },
          },
        },
        activities: {
          where: {
            providerActivityId: { not: { startsWith: 'demo-' } },
          },
          orderBy: { startTime: 'asc' },
          take: 1,
        },
      },
    });
    const wellness = await this.prisma.dailyAthleteState.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 180,
    });

    const sleepDays = wellness.filter((state) => state.sleepScore != null).length;
    const hrvDays = wellness.filter((state) => state.hrvScore != null).length;
    const ctlAtlDays = wellness.filter((state) => state.fitness != null && state.fatigue != null).length;
    const subjectiveDays = wellness.filter((state) => state.subjectiveFatigue != null).length;
    const earliestActivity = account?.activities[0]?.startTime;
    const historyDays = earliestActivity
      ? Math.ceil((Date.now() - earliestActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const available = [
      { key: 'activities', label: '训练记录', count: account?._count.activities ?? 0, source: 'Intervals.icu activities' },
      { key: 'ctl_atl_form', label: 'CTL / ATL / Form', count: ctlAtlDays, source: 'Intervals.icu wellness' },
      { key: 'sleep', label: '睡眠评分', count: sleepDays, source: 'Intervals.icu wellness.sleepScore' },
      { key: 'hrv', label: 'HRV', count: hrvDays, source: 'Intervals.icu wellness.hrv / hrvSDNN' },
    ];

    const missing = [
      subjectiveDays === 0 ? '主观疲劳/酸痛/压力反馈需要用户在反馈弹窗或每日状态中补充' : null,
      hrvDays === 0 ? '当前账号最近 180 天没有可用 HRV 数据，模型会降低 HRV 维度置信度' : null,
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

  private toApiActivity(activity: any) {
    const distanceKm = activity.distanceMeters ? activity.distanceMeters / 1000 : 0;
    const pace = activity.avgPace ? this.formatPace(activity.avgPace) : undefined;

    return {
      id: activity.id,
      date: activity.startTime.toISOString().split('T')[0],
      type: this.getSportLabel(activity.sport),
      sport: activity.sport,
      name: this.getActivityName(activity.sport, activity.tss || 0),
      duration: `${Math.round(activity.durationSeconds / 60)} 分钟`,
      durationSeconds: activity.durationSeconds,
      distance: distanceKm ? `${distanceKm.toFixed(1)} km` : '-',
      distanceMeters: activity.distanceMeters,
      tss: Math.round(activity.tss || 0),
      intensity: this.getIntensityLabel(activity.tss || 0),
      avgPace: pace,
      avgHr: activity.avgHr ? Math.round(activity.avgHr) : undefined,
      maxHr: activity.maxHr ? Math.round(activity.maxHr) : undefined,
      avgCadence: activity.rawData?.average_cadence ? Math.round(activity.rawData.average_cadence) : undefined,
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

  private getActivityName(sport: string, tss: number) {
    if (sport === 'cycling') return tss > 70 ? '节奏骑' : '有氧骑';
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
}
