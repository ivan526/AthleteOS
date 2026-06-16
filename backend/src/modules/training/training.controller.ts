import { Controller, Get, Post, Body, Request, Logger, Query, Param } from '@nestjs/common';
import { DailyStateBuilderService } from '../athlete/daily-state-builder.service';
import { TrainingDecisionEngineService } from './training-decision-engine.service';
import { FeedbackType } from './types';
import { PrismaService } from '../../shared/prisma/prisma.service';

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
  ) {}

  /**
   * 获取今日训练建议
   * PRD 20.1节
   */
  @Get('today')
  async getToday(@Request() req: any) {
    try {
      // TODO: 替换为真实用户ID，待认证系统完成后
      const userId = 'b23d32aa-870a-449e-8572-b1fccd8c00e0';
      const today = new Date();

      // 构建今日状态
      const state = await this.dailyStateBuilder.buildDailyState(userId, today);

      // 生成训练决策
      const decision = await this.decisionEngine.generateDailyDecision(userId, state, today);

      // 转换为API响应格式
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
          id: 'rec_temp', // TODO: 从数据库获取真实ID
          sport: decision.recommendation.sport,
          type: decision.recommendation.type,
          title: decision.recommendation.title,
          duration_minutes: decision.recommendation.durationMinutes,
          expected_tss: decision.recommendation.expectedTss,
          intensity: decision.recommendation.intensity,
          structure: decision.recommendation.structure,
        },
        explanation: {
          simple: decision.decision.userFriendlyReason,
          reasons: decision.decision.evidence.map(e => e.split('=')[1] + ' ' + e.split('=')[0].replace('_', ' ')), // 临时转换
          technical: {
            form: state.form,
            acwr: state.acwr?.acwr,
            monotony: state.monotony?.monotony,
            sleep_score: state.sleepScore,
            hrv_score: state.hrvScore,
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
    @Request() req: any,
  ) {
    // TODO: 替换为真实用户ID
    const userId = 'test-user-id';

    const result = await this.decisionEngine.adjustRecommendation(
      userId,
      body.recommendation_id,
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
            id: 'rec_adjusted',
            sport: result.newRecommendation.sport,
            type: result.newRecommendation.type,
            title: result.newRecommendation.title,
            duration_minutes: result.newRecommendation.durationMinutes,
            expected_tss: result.newRecommendation.expectedTss,
            intensity: result.newRecommendation.intensity,
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
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 30,
    @Request() req: any,
  ) {
    // TODO: 替换为真实用户ID
    const userId = 'b23d32aa-870a-449e-8572-b1fccd8c00e0';

    const activities = await this.prisma.activity.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 转换为前端需要的格式
    return activities.map(activity => ({
      id: activity.id,
      date: activity.startDate.toISOString().split('T')[0],
      type: activity.type,
      name: activity.name,
      duration: `${Math.round(activity.duration / 60)} 分钟`,
      distance: activity.distance ? `${(activity.distance / 1000).toFixed(1)} 公里` : '-',
      tss: activity.tss || 0,
      intensity: this.getIntensityLabel(activity.tss || 0),
      avgPace: activity.avgPace ? `${activity.avgPace.toFixed(2)} /km` : undefined,
      avgHr: activity.avgHr,
      maxHr: activity.maxHr,
      avgCadence: activity.avgCadence,
      elevationGain: activity.elevationGain ? `${Math.round(activity.elevationGain)} 米` : undefined,
      calories: activity.calories,
      notes: activity.description,
    }));
  }

  /**
   * 获取活动详情
   */
  @Get('activities/:id')
  async getActivityDetail(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    // TODO: 替换为真实用户ID
    const userId = 'b23d32aa-870a-449e-8572-b1fccd8c00e0';

    const activity = await this.prisma.activity.findUnique({
      where: { id, userId },
    });

    if (!activity) {
      throw new Error('活动不存在');
    }

    return {
      id: activity.id,
      date: activity.startDate.toISOString().split('T')[0],
      type: activity.type,
      name: activity.name,
      duration: `${Math.round(activity.duration / 60)} 分钟`,
      distance: activity.distance ? `${(activity.distance / 1000).toFixed(1)} 公里` : '-',
      tss: activity.tss || 0,
      intensity: this.getIntensityLabel(activity.tss || 0),
      avgPace: activity.avgPace ? `${activity.avgPace.toFixed(2)} /km` : undefined,
      avgHr: activity.avgHr,
      maxHr: activity.maxHr,
      avgCadence: activity.avgCadence,
      elevationGain: activity.elevationGain ? `${Math.round(activity.elevationGain)} 米` : undefined,
      calories: activity.calories,
      notes: activity.description,
      splits: [], // TODO: 实现分段数据
    };
  }

  /**
   * 获取周复盘数据
   */
  @Get('weekly-review')
  async getWeeklyReview(
    @Query('weekOffset') weekOffset: number = 0,
    @Request() req: any,
  ) {
    // TODO: 替换为真实用户ID
    const userId = 'b23d32aa-870a-449e-8572-b1fccd8c00e0';

    // 计算周的起止日期（周一到周日）
    const baseDate = new Date();
    const currentDay = baseDate.getDay();
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - currentDay + 1 - (weekOffset * 7));

    const weekStart = new Date(monday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 查询本周的所有活动
    const activities = await this.prisma.activity.findMany({
      where: {
        userId,
        startDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // 计算周统计
    const totalTss = activities.reduce((sum, act) => sum + (act.tss || 0), 0);
    const trainingDays = activities.filter(act => (act.tss || 0) > 0).length;
    const adherence = trainingDays / 7;

    // 查询上周数据对比
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(weekEnd.getDate() - 7);

    const lastWeekActivities = await this.prisma.activity.findMany({
      where: {
        userId,
        startDate: {
          gte: lastWeekStart,
          lte: lastWeekEnd,
        },
      },
    });

    const lastWeekTss = lastWeekActivities.reduce((sum, act) => sum + (act.tss || 0), 0);
    const loadChange = lastWeekTss > 0 ? (totalTss - lastWeekTss) / lastWeekTss : 0;

    // 生成每日数据
    const dailyStats = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dayStr = `${dayDate.getMonth() + 1}月${dayDate.getDate()}日`;

      const dayActivities = activities.filter(act => {
        const actDate = new Date(act.startDate);
        return actDate.getDate() === dayDate.getDate() &&
               actDate.getMonth() === dayDate.getMonth();
      });

      const dayTss = dayActivities.reduce((sum, act) => sum + (act.tss || 0), 0);

      dailyStats.push({
        date: dayStr,
        tss: dayTss,
        type: dayTss > 0 ? 'training' : 'rest',
      });
    }

    // 风险评估
    const trainingRiskLevel = totalTss > lastWeekTss * 1.2
      ? 'moderate'
      : totalTss > lastWeekTss * 1.5
        ? 'elevated'
        : 'low';

    // 生成总结和建议
    let summary = '本周训练负荷稳定，完成情况良好。';
    let highlights = [
      `完成 ${trainingDays} 次训练，完成率 ${Math.round(adherence * 100)}%`,
      `周总TSS: ${totalTss}`,
    ];
    let warnings: string[] = [];

    if (loadChange > 0.1) {
      summary = '本周训练负荷有所上升，整体完成情况良好。';
      highlights.push(`周负荷增长 ${Math.round(loadChange * 100)}%`);
      if (loadChange > 0.2) {
        warnings.push('周负荷增长偏快，注意充分恢复');
        warnings.push('建议下周适当控制高强度训练次数');
      }
    } else if (loadChange < -0.1) {
      summary = '本周训练负荷有所下降，以恢复调整为主。';
      highlights.push(`周负荷下降 ${Math.round(Math.abs(loadChange) * 100)}%`);
      warnings.push('下周可以适当增加训练负荷');
      warnings.push('保持规律的训练节奏更有利于进步');
    }

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      summary,
      adherence,
      weeklyTss: totalTss,
      loadChangeVsLastWeek: loadChange,
      trainingRiskLevel,
      highlights,
      warnings,
      dailyStats,
    };
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
}
