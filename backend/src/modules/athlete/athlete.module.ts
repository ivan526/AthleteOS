import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AcwrEngineService } from './acwr-engine.service';
import { MonotonyEngineService } from './monotony-engine.service';
import { TrainingRiskEngineService } from './training-risk-engine.service';
import { TrainingCapacityEngineService } from './training-capacity-engine.service';
import { HardSafetyRulesService } from './hard-safety-rules.service';
import { DailyStateBuilderService } from './daily-state-builder.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AcwrEngineService,
    MonotonyEngineService,
    TrainingRiskEngineService,
    TrainingCapacityEngineService,
    HardSafetyRulesService,
    DailyStateBuilderService,
  ],
  exports: [
    AcwrEngineService,
    MonotonyEngineService,
    TrainingRiskEngineService,
    TrainingCapacityEngineService,
    HardSafetyRulesService,
    DailyStateBuilderService,
  ],
})
export class AthleteModule {}
