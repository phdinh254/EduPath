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
    logger.log(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });

  next();
}
