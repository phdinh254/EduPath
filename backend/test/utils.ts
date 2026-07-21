import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

export interface TokenBody {
  accessToken: string;
  refreshToken: string;
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
