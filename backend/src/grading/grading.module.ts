import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GradingService } from './grading.service';
import { GradingController } from './grading.controller';
import { GradeEssayProcessor } from './grade-essay.processor';
import { GRADE_ESSAY_QUEUE } from './grading-queue.constants';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    RoadmapModule,
    ReadinessModule,
    AiModule,
    BullModule.registerQueue({
      name: GRADE_ESSAY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    }),
  ],
  providers: [GradingService, GradeEssayProcessor],
  controllers: [GradingController],
  exports: [GradingService],
})
export class GradingModule {}
