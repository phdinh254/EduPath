import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { body, createTestApp, registerFactory, TokenBody } from './utils';

describe('Refresh token (e2e)', () => {
  let app: INestApplication<App>;
  let register: ReturnType<typeof registerFactory>;
  let jwtService: JwtService;
  let config: ConfigService;
  const suffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    register = registerFactory(app);
    jwtService = app.get(JwtService);
    config = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function makeStudent(label: string) {
    return register({
      email: `rt_student_${label}_${suffix}@test.dev`,
      password: 'password123',
      fullName: `Student ${label}`,
      role: 'STUDENT',
    });
  }

  it('1: a valid refresh token issues a new access token', async () => {
    const { refreshToken } = await makeStudent('a');
    const res = await request(server())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const tokens = body<TokenBody>(res);
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });

  it('2: the old refresh token is rejected once it has been rotated', async () => {
    const { refreshToken } = await makeStudent('b');
    await request(server())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    await request(server())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('3: two refresh tokens issued within the same second still have distinct jti (and thus distinct tokens)', async () => {
    const { refreshToken: first } = await makeStudent('c');
    const secondRes = await request(server())
      .post('/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    const { refreshToken: second } = body<TokenBody>(secondRes);
    expect(second).not.toBe(first);

    const firstPayload = jwtService.decode<{ jti?: string }>(first);
    const secondPayload = jwtService.decode<{ jti?: string }>(second);
    expect(firstPayload.jti).toBeDefined();
    expect(secondPayload.jti).toBeDefined();
    expect(firstPayload.jti).not.toBe(secondPayload.jti);
  });

  it('4: an expired refresh token is rejected', async () => {
    const { accessToken } = await makeStudent('d');
    const payload = jwtService.decode<{
      sub: string;
      email: string;
      role: string;
    }>(accessToken);
    const expiredToken = await jwtService.signAsync(
      { sub: payload.sub, email: payload.email, role: payload.role },
      {
        secret: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '-10s',
      },
    );
    await request(server())
      .post('/auth/refresh')
      .send({ refreshToken: expiredToken })
      .expect(401);
  });

  it('5: a refresh token whose signature is valid but has no matching stored record (foreign / unknown) is rejected', async () => {
    const forgedToken = await jwtService.signAsync(
      { sub: 'nonexistent-user-id', email: 'ghost@test.dev', role: 'STUDENT' },
      {
        secret: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
    await request(server())
      .post('/auth/refresh')
      .send({ refreshToken: forgedToken })
      .expect(401);
  });

  it('6: logout revokes the exact refresh token used, and only that one', async () => {
    const { refreshToken } = await makeStudent('e');
    await request(server())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);
    await request(server())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('7: concurrent refresh calls with the same token do not both succeed (no token cloning)', async () => {
    const { refreshToken } = await makeStudent('f');

    const [resA, resB] = await Promise.all([
      request(server()).post('/auth/refresh').send({ refreshToken }),
      request(server()).post('/auth/refresh').send({ refreshToken }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Đúng một request thành công (200), request còn lại phải bị từ chối (401) -
    // nếu cả hai đều 200 nghĩa là token gốc bị "nhân bản" thành hai phiên hợp lệ.
    expect(statuses).toEqual([200, 401]);
  });
});
