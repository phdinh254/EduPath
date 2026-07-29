import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// refreshToken không còn nằm trong JSON body — backend đặt thẳng vào cookie
// HttpOnly (xem AuthController). Test nào cần refreshToken phải tự đọc
// Set-Cookie từ response (xem extractRefreshCookie trong refresh-token.e2e-spec.ts).
export interface TokenBody {
  accessToken: string;
}
export interface IdBody {
  id: string;
}

export function body<T>(res: request.Response): T {
  return res.body as T;
}

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  // Khớp main.ts thật — /auth/refresh và /auth/logout đọc refreshToken từ
  // cookie, không có middleware này thì req.cookies luôn undefined.
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export function registerFactory(app: INestApplication<App>) {
  const server = () => app.getHttpServer();
  return async function register(
    payload: Record<string, unknown>,
  ): Promise<TokenBody> {
    const res = await request(server())
      .post('/auth/register')
      .send(payload)
      .expect(201);
    return body<TokenBody>(res);
  };
}

// Không có luồng tự đăng ký ADMIN (đúng chủ đích bảo mật) — test tạo thẳng
// user ADMIN qua Prisma rồi đăng nhập bình thường để lấy token thật.
export function adminFactory(app: INestApplication<App>) {
  const server = () => app.getHttpServer();
  const prisma = app.get(PrismaService);
  return async function makeAdmin(email: string): Promise<TokenBody> {
    const password = 'password123';
    const passwordHash = (await argon2.hash(password)) as string;
    await prisma.user.create({
      data: { email, passwordHash, fullName: 'Admin', role: 'ADMIN' },
    });
    const res = await request(server())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return body<TokenBody>(res);
  };
}
