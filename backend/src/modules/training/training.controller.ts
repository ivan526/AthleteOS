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
    // TODO: 实现真实活动数据查询，暂时返回空数组
    return [];
  }

  /**
   * 获取活动详情
   */
  @Get('activities/:id')
  async getActivityDetail(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    // TODO: 实现真实活动详情查询
    throw new Error('活动详情接口待实现');
  }

  /**
   * 获取周复盘数据
   */
  @Get('weekly-review')
  async getWeeklyReview(
    @Query('weekOffset') weekOffset: number = 0,
    @Request() req: any,
  ) {
    // 计算周的起止日期（周一到周日）
    const baseDate = new Date();
    const currentDay = baseDate.getDay();
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - currentDay + 1 - (weekOffset * 7));

    const weekStart = new Date(monday);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);

    const formatDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // 暂时返回模拟数据
    return {
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      summary: '本周训练负荷稳定，完成情况良好。',
      adherence: 0.85,
      weeklyTss: 430,
      loadChangeVsLastWeek: 0.06,
      trainingRiskLevel: 'low',
      highlights: [
        '完成 6 次训练，完成率 86%',
        '周总TSS: 430',
        '周负荷增长 6%，处于合理范围'
      ],
      warnings: [
        '训练结构合理，继续保持',
        '保证充足睡眠和营养补充'
      ],
      dailyStats: [
        { date: '6月10日', tss: 28, type: 'training' },
        { date: '6月11日', tss: 82, type: 'training' },
        { date: '6月12日', tss: 40, type: 'training' },
        { date: '6月13日', tss: 32, type: 'training' },
        { date: '6月14日', tss: 65, type: 'training' },
        { date: '6月15日', tss: 0, type: 'rest' },
        { date: '6月16日', tss: 0, type: 'rest' },
      ],
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
