import { Controller, Get, Post } from '@nestjs/common';
import { MockDataService } from './modules/sync/mock-data.service';
import { DailyStateBuilderService } from './modules/athlete/daily-state-builder.service';
import { AcwrEngineService } from './modules/athlete/acwr-engine.service';
import { MonotonyEngineService } from './modules/athlete/monotony-engine.service';
import { HardSafetyRulesService } from './modules/athlete/hard-safety-rules.service';
import { WorkoutGeneratorService } from './modules/training/workout-generator.service';
import { Activity } from '@prisma/client';

/**
 * 测试用控制器，仅用于开发阶段
 */
@Controller('api/test')
export class TestController {
  constructor(
    private mockDataService: MockDataService,
    private dailyStateBuilder: DailyStateBuilderService,
    private acwrEngine: AcwrEngineService,
    private monotonyEngine: MonotonyEngineService,
    private hardSafetyRules: HardSafetyRulesService,
    private workoutGenerator: WorkoutGeneratorService,
  ) {}

  /**
   * 生成完整的测试数据
   */
  @Post('generate-mock')
  async generateMockData() {
    const result = await this.mockDataService.generateFullMockData();
    return result;
  }

  /**
   * 测试计算每日状态
   */
  @Get('build-daily-state')
  async buildDailyState() {
    // 使用测试用户ID
    const testUserId = 'b23d32aa-870a-449e-8572-b1fccd8c00e0';
    const state = await this.dailyStateBuilder.buildDailyState(testUserId);
    return {
      success: true,
      data: {
        dataLevel: state.dataLevel,
        dataQuality: state.dataQuality,
        fitness: state.fitness,
        fatigue: state.fatigue,
        form: state.form,
        acwr: state.acwr,
        monotony: state.monotony,
        trainingCapacity: state.trainingCapacity,
        trainingRisk: state.trainingRisk,
        hardSafety: state.hardSafety,
        confidence: state.confidence,
      },
    };
  }

  @Get('prd-acceptance')
  async runPrdAcceptance() {
    const referenceDate = new Date('2026-06-17T00:00:00.000Z');
    const normalState = this.createState({
      score: 76,
      form: -8,
      acwr: 1.1,
      dataLevel: 'B',
      sleepScore: 84,
      riskLevel: 'low',
    });
    const normalWorkout = this.workoutGenerator.generateWorkout(normalState, 'running', 60);
    const normalSafety = this.hardSafetyRules.checkRules({
      trainingCapacity: normalState.trainingCapacity,
      trainingRisk: normalState.trainingRisk,
      acwr: normalState.acwr,
      form: normalState.form,
    });

    const lowCapacitySafety = this.hardSafetyRules.checkRules({
      trainingCapacity: this.createCapacity(35),
      trainingRisk: this.createRisk('moderate', 0.4),
    });

    const extremeFormSafety = this.hardSafetyRules.checkRules({
      trainingCapacity: this.createCapacity(65),
      trainingRisk: this.createRisk('moderate', 0.4),
      form: -30,
    });

    const zeroChronicAcwr = this.acwrEngine.calculate([], referenceDate);
    const equalLoadActivities = [1, 2, 3, 4, 5, 6, 7].map((daysAgo) => this.createActivity(daysAgo, 50, referenceDate));
    const equalLoadMonotony = this.monotonyEngine.calculate(equalLoadActivities, referenceDate);
    const dLevelState = this.createState({ score: 65, form: -2, acwr: 1.0, dataLevel: 'D', riskLevel: 'low' });
    const dLevelWorkout = this.workoutGenerator.generateWorkout(dLevelState, 'running', 60);
    const aiSafetyAllowedTypes = this.hardSafetyRules.getAllowedWorkoutTypes([
      {
        rule: 'ACWR Protection',
        condition: 'acwr > 1.5',
        value: '1.8',
        action: '禁止高强度训练，建议轻松日或恢复日',
      },
    ]);

    const scenarios = [
      {
        id: '25.1',
        name: '正常训练日',
        passed:
          normalState.trainingCapacity.score === 76 &&
          ['tempo_run', 'steady_run'].includes(normalWorkout.type) &&
          !normalSafety.triggered,
        details: { workoutType: normalWorkout.type, safetyTriggered: normalSafety.triggered },
      },
      {
        id: '25.2',
        name: 'Training Capacity 低',
        passed:
          lowCapacitySafety.triggered &&
          lowCapacitySafety.rules.some((rule) => rule.rule === 'Training Capacity Protection'),
        details: lowCapacitySafety,
      },
      {
        id: '25.3',
        name: 'Form 极低',
        passed:
          extremeFormSafety.triggered &&
          extremeFormSafety.rules.some((rule) => rule.rule === 'Extreme Fatigue Protection'),
        details: extremeFormSafety,
      },
      {
        id: '25.4',
        name: 'ACWR chronic_load = 0',
        passed:
          zeroChronicAcwr.acwr === null &&
          zeroChronicAcwr.dataQuality === 'insufficient' &&
          Number.isFinite(zeroChronicAcwr.acuteLoad) &&
          Number.isFinite(zeroChronicAcwr.chronicLoad),
        details: zeroChronicAcwr,
      },
      {
        id: '25.5',
        name: 'Monotony std = 0',
        passed:
          equalLoadMonotony.monotony === 3.0 &&
          equalLoadMonotony.level === 'severe' &&
          Number.isFinite(equalLoadMonotony.monotony),
        details: equalLoadMonotony,
      },
      {
        id: '25.8',
        name: 'data_level = D',
        passed:
          ['easy_run', 'steady_run', 'recovery_run'].includes(dLevelWorkout.type) &&
          !['interval_run', 'tempo_run', 'long_easy_run'].includes(dLevelWorkout.type),
        details: { workoutType: dLevelWorkout.type },
      },
      {
        id: '25.9',
        name: '硬规则不可被 AI Coach 覆盖',
        passed:
          !aiSafetyAllowedTypes.includes('interval_run') &&
          !aiSafetyAllowedTypes.includes('tempo_run'),
        details: { allowedTypes: aiSafetyAllowedTypes },
      },
    ];

    return {
      passed: scenarios.every((scenario) => scenario.passed),
      scenarios,
    };
  }

  private createActivity(daysAgo: number, tss: number, referenceDate: Date): Activity {
    const startTime = new Date(referenceDate);
    startTime.setDate(referenceDate.getDate() - daysAgo);
    return {
      id: `test-${daysAgo}`,
      connectedAccountId: 'test-account',
      providerActivityId: `test-provider-${daysAgo}`,
      sport: 'running',
      startTime,
      durationSeconds: 3600,
      distanceMeters: 10000,
      tss,
      intensityFactor: null,
      avgHr: null,
      maxHr: null,
      avgPower: null,
      normalizedPower: null,
      avgPace: null,
      elevationGain: null,
      rawData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createState(params: {
    score: number;
    form: number;
    acwr: number;
    dataLevel: 'A' | 'B' | 'C' | 'D';
    riskLevel: 'low' | 'moderate' | 'elevated' | 'high_caution';
    sleepScore?: number;
  }): any {
    return {
      userId: 'test',
      date: new Date(),
      dataLevel: params.dataLevel,
      dataQuality: { overall: 'medium', historyDays: 56, activityCount: 30 },
      form: params.form,
      sleepScore: params.sleepScore,
      acwr: {
        acwr: params.acwr,
        acuteLoad: 200,
        chronicLoad: 180,
        level: params.acwr < 1.3 ? 'optimal' : 'elevated',
        dataQuality: 'medium',
        confidence: 0.8,
      },
      monotony: {
        monotony: 1.7,
        level: 'warning',
        dataQuality: 'medium',
        confidence: 0.7,
      },
      trainingCapacity: this.createCapacity(params.score),
      trainingRisk: this.createRisk(params.riskLevel, params.riskLevel === 'low' ? 0.2 : 0.4),
      hardSafety: { triggered: false, rules: [] },
      confidence: 0.8,
    };
  }

  private createCapacity(score: number): any {
    return {
      score,
      status: score < 40 ? 'Recovery Required' : score < 61 ? 'Reduce Intensity' : 'Train Normally',
      confidence: 0.8,
      dataQuality: 'medium',
      subscores: {},
      summary: '',
    };
  }

  private createRisk(level: 'low' | 'moderate' | 'elevated' | 'high_caution', score: number): any {
    return {
      score,
      level,
      userLabel: level === 'low' ? '训练风险较低' : '训练风险中等，建议控制强度',
      confidence: 0.8,
      dataQuality: 'medium',
      mainFactors: [],
      safeRecommendation: '',
    };
  }
}
