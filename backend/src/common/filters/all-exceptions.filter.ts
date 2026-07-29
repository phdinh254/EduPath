import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Bắt MỌI exception (kể cả lỗi không phải HttpException — bug thật, lỗi
// Prisma...) để: 1) luôn log một dòng JSON có cấu trúc kèm requestId (khớp
// với requestLoggingMiddleware) phục vụ tra cứu; 2) vẫn trả về đúng contract
// JSON hiện có ({message, error, statusCode}) mà frontend đang đọc, thay vì
// để Nest tự xử lý mặc định (không có requestId trong log).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawBody = isHttpException ? exception.getResponse() : null;
    const payload: Record<string, unknown> =
      typeof rawBody === 'string'
        ? { message: rawBody }
        : rawBody && typeof rawBody === 'object'
          ? { ...(rawBody as Record<string, unknown>) }
          : { message: 'Đã xảy ra lỗi không xác định trên máy chủ' };
    payload.statusCode = status;

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? null;
    const message = isHttpException
      ? exception.message
      : String((exception as Error | undefined)?.message ?? exception);

    this.logger.error(
      JSON.stringify({
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: status,
        message,
        // Chỉ log stack cho lỗi 5xx thật sự — lỗi 4xx (validation, quyền hạn...)
        // là hành vi nghiệp vụ bình thường, không phải bug cần điều tra.
        stack:
          status >= 500 && exception instanceof Error
            ? exception.stack
            : undefined,
      }),
    );

    response.status(status).json(payload);
  }
}
