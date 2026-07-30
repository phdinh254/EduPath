import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GradingService } from './grading.service';
import { GradingController } from './grading.controller';
import { GradeEssayProcessor } from './grade-essay.processor';
import {
  OutboxSweepProcessor,
  OUTBOX_SWEEP_QUEUE,
} from './outbox-sweep.processor';
import { GRADE_ESSAY_QUEUE } from './grading-queue.constants';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    RoadmapModule,
    ReadinessModule,
    AiModule,
    BullModule.registerQueue(
      {
        name: GRADE_ESSAY_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      },
      { name: OUTBOX_SWEEP_QUEUE },
    ),
  ],
  providers: [GradingService, GradeEssayProcessor, OutboxSweepProcessor],
  controllers: [GradingController],
  exports: [GradingService],
})
export class GradingModule {}
