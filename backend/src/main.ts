import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { requestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // bodyParser: false — tự đăng ký json()/urlencoded() bên dưới với limit
  // tường minh thay vì dùng mặc định ẩn của Nest.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Nginx (và, khi bật HTTPS, Caddy đứng trước Nginx — xem devops/Caddyfile)
  // là (các) reverse proxy DUY NHẤT phép tin — nếu không khai báo, Express
  // coi socket kết nối trực tiếp (luôn là Nginx trong container) là "client",
  // nên req.ip là IP nội bộ của Nginx cho MỌI người dùng thật. ThrottlerGuard
  // (xem AppThrottlerGuard) dựa vào req.ip, nên hậu quả là rate limit áp dụng
  // DÙNG CHUNG một bộ đếm cho toàn bộ traffic production — 5 request đăng
  // ký/đăng nhập của BẤT KỲ ai trong 1 phút khoá tạm luôn cả những người khác.
  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS'));

  // Giới hạn kích thước request — đủ chỗ cho văn bản đề thi thật ADMIN dán
  // vào (xem ParseExamImportDto, tối đa 20k ký tự) nhưng chặn payload khổng
  // lồ cố tình gửi lên để tốn tài nguyên parse/băng thông.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Đọc cookie refreshToken HttpOnly (xem AuthController) — không ký cookie
  // riêng vì giá trị bên trong đã là JWT tự ký.
  app.use(cookieParser());

  // Correlation ID + log JSON có cấu trúc cho mỗi request (xem middleware).
  app.use(requestLoggingMiddleware);

  // CSP mặc định của helmet chặn cả script/style Swagger UI cần — chỉ tắt
  // CSP ở dev (nơi Swagger được bật), production luôn giữ nguyên CSP mặc định.
  app.use(helmet(isProduction ? undefined : { contentSecurityPolicy: false }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Log có cấu trúc (kèm requestId) cho MỌI lỗi trả về, không chỉ lỗi 5xx —
  // xem AllExceptionsFilter.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger để trống thông tin nội bộ (danh sách route, DTO...) không nên lộ
  // công khai ở production.
  if (!isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('EduPath API')
        .setDescription(
          'RESTful API cho hệ thống luyện thi thử THPT có lộ trình cá nhân hóa bằng AI',
        )
        .setVersion('0.1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api-docs', app, document);
  }

  // Cho phép NestJS gọi onModuleDestroy (vd. PrismaService.$disconnect) khi
  // nhận SIGTERM/SIGINT — không cắt kết nối DB đột ngột khi container bị dừng.
  app.enableShutdownHooks();

  await app.listen(config.get<number>('PORT') ?? 3000);
}
void bootstrap();
