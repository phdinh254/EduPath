import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { MetricsService } from './metrics.service';

// Ghi số liệu cho MỌI request đi qua HTTP layer (bất kể thành công hay lỗi) —
// dùng route pattern (vd. "/exams/:id") thay vì URL thật để không làm nổ số
// lượng label theo từng ID cụ thể. Nghe sự kiện 'finish' của response (thay vì
// đọc res.statusCode ngay trong tap của observable) vì AllExceptionsFilter chỉ
// thật sự set status code SAU KHI observable đã báo lỗi — đọc sớm sẽ luôn
// thấy mã mặc định (200) cho mọi response lỗi.
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();
    const method = req.method;
    const route =
      (req.route as { path?: string } | undefined)?.path ??
      req.path ??
      'unknown';

    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.recordHttpRequest(
        method,
        route,
        res.statusCode,
        durationSeconds,
      );
    });

    return next.handle();
  }
}
