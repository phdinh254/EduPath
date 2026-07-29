import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { GradingService } from './grading.service';
import {
  GRADE_ESSAY_QUEUE,
  type GradeEssayJobData,
} from './grading-queue.constants';
import { MetricsService } from '../metrics/metrics.service';

// Concurrency giới hạn số job chấm tự luận chạy song song — tránh dồn dập gọi
// Gemini cùng lúc (ngân sách/ngày và timeout đã có riêng ở GeminiService, đây
// là lớp giới hạn thứ hai ở tầng hàng đợi).
const CONCURRENCY = 3;

@Processor(GRADE_ESSAY_QUEUE, { concurrency: CONCURRENCY })
export class GradeEssayProcessor extends WorkerHost {
  private readonly logger = new Logger(GradeEssayProcessor.name);

  constructor(
    private readonly gradingService: GradingService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<GradeEssayJobData>): Promise<void> {
    await this.gradingService.processQueuedEssayGrading(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(): void {
    this.metrics.recordAiJob(GRADE_ESSAY_QUEUE, 'completed');
  }

  // BullMQ tự động retry theo defaultJobOptions (xem GradingModule) trước khi
  // bắn 'failed' — chỉ coi là thất bại thật sự (chuyển ADMIN chấm tay) khi đã
  // dùng hết số lần thử, tránh đánh dấu needsManualGrading quá sớm giữa các
  // lần retry.
  @OnWorkerEvent('failed')
  async onFailed(job: Job<GradeEssayJobData> | undefined): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    this.metrics.recordAiJob(GRADE_ESSAY_QUEUE, 'failed');
    this.logger.warn(
      `Chấm tự luận qua AI thất bại sau ${job.attemptsMade} lần thử (attemptId=${job.data.attemptId}, questionId=${job.data.questionId}) — chuyển ADMIN chấm tay`,
    );
    await this.gradingService.markEssayGradingFailed(
      job.data.attemptId,
      job.data.questionId,
    );
  }
}
