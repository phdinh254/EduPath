import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { GenerateQuestionsProcessor } from './generate-questions.processor';
import { GENERATE_QUESTIONS_QUEUE } from './generate-questions-queue.constants';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({
      name: GENERATE_QUESTIONS_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    }),
  ],
  providers: [QuestionsService, GenerateQuestionsProcessor],
  controllers: [QuestionsController],
  exports: [QuestionsService],
})
export class QuestionsModule {}
