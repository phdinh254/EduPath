import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { RoadmapService } from './roadmap.service';
import {
  GENERATE_ADVICE_QUEUE,
  type GenerateAdviceJobData,
} from './generate-advice-queue.constants';
import { MetricsService } from '../metrics/metrics.service';

const CONCURRENCY = 2;

@Processor(GENERATE_ADVICE_QUEUE, { concurrency: CONCURRENCY })
export class GenerateAdviceProcessor extends WorkerHost {
  constructor(
    private readonly roadmapService: RoadmapService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<GenerateAdviceJobData>): Promise<void> {
    await this.roadmapService.processGenerateAdviceJob(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(): void {
    this.metrics.recordAiJob(GENERATE_ADVICE_QUEUE, 'completed');
  }

  @OnWorkerEvent('failed')
  onFailed(): void {
    this.metrics.recordAiJob(GENERATE_ADVICE_QUEUE, 'failed');
  }
}
