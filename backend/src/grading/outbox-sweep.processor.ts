import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { GradingService } from './grading.service';

export const OUTBOX_SWEEP_QUEUE = 'outbox-sweep';
const SWEEP_INTERVAL_MS = 60_000;
// jobId cố định cho job lặp lại — add() lại với cùng jobId+repeat không tạo
// thêm lịch trùng, kể cả khi có nhiều instance backend cùng khởi động
// (Kubernetes/Compose scale > 1).
const SWEEP_JOB_ID = 'outbox-sweep-tick';

// Lưới an toàn cho GradingService.submitAttempt (xem P0 issue #3): quét định
// kỳ để phát lại OutboxEvent còn PENDING (Redis lỗi lúc submit) và finalize
// nốt các ExamAttempt kẹt ở SUBMITTED (tiến trình chết ngay sau khi
// transaction chấm điểm commit, trước khi kịp gọi recomputeScore()).
@Injectable()
@Processor(OUTBOX_SWEEP_QUEUE)
export class OutboxSweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OutboxSweepProcessor.name);

  constructor(
    private readonly gradingService: GradingService,
    @InjectQueue(OUTBOX_SWEEP_QUEUE) private readonly sweepQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.sweepQueue.add(
      'sweep',
      {},
      {
        jobId: SWEEP_JOB_ID,
        repeat: { every: SWEEP_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async process(): Promise<void> {
    const [outboxCount, stuckCount] = await Promise.all([
      this.gradingService.recoverPendingOutboxEvents(),
      this.gradingService.recoverStuckSubmissions(),
    ]);
    if (outboxCount > 0 || stuckCount > 0) {
      this.logger.warn(
        `Outbox sweep: phát lại ${outboxCount} job tự luận treo, khôi phục ${stuckCount} attempt kẹt ở SUBMITTED`,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(): void {
    this.logger.error(
      'Outbox sweep job thất bại — sẽ tự chạy lại ở lượt kế tiếp (60s)',
    );
  }
}
