import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

// Đăng ký riêng một Registry (không dùng global register mặc định của
// prom-client) để tránh đăng ký trùng metric khi Nest hot-reload trong dev.
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly aiJobsTotal: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Tổng số request HTTP đã xử lý',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Thời gian xử lý request HTTP (giây)',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });
    // Đếm job AI (chấm tự luận/sinh câu hỏi/lời khuyên) theo hàng đợi và kết
    // quả — xem GradeEssayProcessor/GenerateQuestionsProcessor/GenerateAdviceProcessor.
    this.aiJobsTotal = new Counter({
      name: 'ai_jobs_total',
      help: 'Tổng số job AI đã xử lý qua BullMQ, theo hàng đợi và trạng thái',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  recordAiJob(queue: string, status: 'completed' | 'failed'): void {
    this.aiJobsTotal.inc({ queue, status });
  }

  getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
