import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AthleteModule } from '../athlete/athlete.module';
import { WorkoutGeneratorService } from './workout-generator.service';
import { ExplanationEngineService } from './explanation-engine.service';
import { TrainingDecisionEngineService } from './training-decision-engine.service';
import { TrainingController } from './training.controller';
import { AiCoachGuardrailService } from './ai-coach-guardrail.service';
import { LlmCoachService } from './llm-coach.service';

@Module({
  imports: [PrismaModule, AthleteModule],
  controllers: [TrainingController],
  providers: [
    WorkoutGeneratorService,
    ExplanationEngineService,
    AiCoachGuardrailService,
    LlmCoachService,
    TrainingDecisionEngineService,
  ],
  exports: [
    WorkoutGeneratorService,
    ExplanationEngineService,
    AiCoachGuardrailService,
    LlmCoachService,
    TrainingDecisionEngineService,
  ],
})
export class TrainingModule {}
