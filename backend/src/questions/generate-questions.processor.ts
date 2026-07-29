import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QuestionsService } from './questions.service';
import {
  GENERATE_QUESTIONS_QUEUE,
  type GenerateQuestionsJobData,
} from './generate-questions-queue.constants';
import { MetricsService } from '../metrics/metrics.service';

const CONCURRENCY = 2;

// synthesize() bên trong QuestionsService đã tự fallback rule-based khi
// Gemini lỗi/chưa cấu hình, nên job này gần như không bao giờ throw vì lý do
// AI — chỉ có thể lỗi thật sự nếu Prisma/DB gặp sự cố, lúc đó BullMQ tự retry
// theo defaultJobOptions (xem QuestionsModule).
@Processor(GENERATE_QUESTIONS_QUEUE, { concurrency: CONCURRENCY })
export class GenerateQuestionsProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerateQuestionsProcessor.name);

  constructor(
    private readonly questionsService: QuestionsService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<GenerateQuestionsJobData>): Promise<void> {
    const created = await this.questionsService.processGenerateQuestionsJob(
      job.data,
    );
    this.logger.log(
      `Đã sinh bù ${created}/${job.data.count} câu hỏi vào hàng chờ duyệt (topic=${job.data.topicId})`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(): void {
    this.metrics.recordAiJob(GENERATE_QUESTIONS_QUEUE, 'completed');
  }

  @OnWorkerEvent('failed')
  onFailed(): void {
    this.metrics.recordAiJob(GENERATE_QUESTIONS_QUEUE, 'failed');
  }
}
