import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

// Gắn/đọc correlation ID (X-Request-Id) và log một dòng JSON có cấu trúc mỗi
// request — đủ để tra một request cụ thể qua nhiều log line (vd. lỗi Gemini
// xảy ra giữa lúc xử lý request nào) mà không cần kéo cả một logging stack
// (pino/winston) cho quy mô dự án hiện tại.
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) || randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    // originalUrl có thể chứa query string nhạy cảm (vd. ?code=...&state=...
    // của OAuth callback Google, xem AuthController.googleCallback) — chỉ log
    // path, không log query string.
    const path = req.originalUrl.split('?')[0];
    const entry = {
      requestId,
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    };
    // 5xx là lỗi hệ thống thật sự (đáng alert) — 4xx thường là lỗi phía
    // client (401 sai mật khẩu, 404 route không tồn tại...) và xảy ra liên
    // tục trong vận hành bình thường, không nên cùng mức độ nghiêm trọng với
    // 5xx trên dashboard log.
    if (res.statusCode >= 500) {
      logger.error(JSON.stringify(entry));
    } else if (res.statusCode >= 400) {
      logger.warn(JSON.stringify(entry));
    } else {
      logger.log(JSON.stringify(entry));
    }
  });

  next();
}
