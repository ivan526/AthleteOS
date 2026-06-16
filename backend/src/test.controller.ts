import { Controller, Get, Post } from '@nestjs/common';
import { MockDataService } from './modules/sync/mock-data.service';
import { DailyStateBuilderService } from './modules/athlete/daily-state-builder.service';

/**
 * 测试用控制器，仅用于开发阶段
 */
@Controller('api/test')
export class TestController {
  constructor(
    private mockDataService: MockDataService,
    private dailyStateBuilder: DailyStateBuilderService,
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
}
