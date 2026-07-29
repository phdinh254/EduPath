import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RoadmapService } from './roadmap.service';
import { RoadmapController } from './roadmap.controller';
import { GenerateAdviceProcessor } from './generate-advice.processor';
import { GENERATE_ADVICE_QUEUE } from './generate-advice-queue.constants';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({
      name: GENERATE_ADVICE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    }),
  ],
  providers: [RoadmapService, GenerateAdviceProcessor],
  controllers: [RoadmapController],
  exports: [RoadmapService],
})
export class RoadmapModule {}
