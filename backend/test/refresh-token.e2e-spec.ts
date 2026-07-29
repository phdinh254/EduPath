import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { body, createTestApp, TokenBody } from './utils';

// refreshToken không còn trả về trong JSON body — backend đặt vào cookie
// HttpOnly `refreshToken` (path=/auth, xem AuthController). Test ở đây phải tự
// đọc/gửi cookie qua header Set-Cookie/Cookie thay vì field trong body JSON.
function extractRefreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as
    string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c) => c.startsWith('refreshToken='));
  if (!found) {
    throw new Error(
      'Không tìm thấy cookie refreshToken trong response — kiểm tra lại AuthController',
    );
  }
  return found.split(';')[0]; // "refreshToken=<jwt>"
}

describe('Refresh token (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let config: ConfigService;
  const suffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    jwtService = app.get(JwtService);
    config = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function registerAndGetRefreshCookie(label: string): Promise<string> {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email: `rt_student_${label}_${suffix}@test.dev`,
        password: 'password123',
        fullName: `Student ${label}`,
      })
      .expect(201);
    return extractRefreshCookie(res);
  }

  it('1: a valid refresh token issues a new access token', async () => {
    const cookie = await registerAndGetRefreshCookie('a');
    const res = await request(server())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    const tokens = body<TokenBody>(res);
    expect(tokens.accessToken).toBeDefined();
    expect(extractRefreshCookie(res)).toMatch(/^refreshToken=/);
  });

  it('2: the old refresh token is rejected once it has been rotated', async () => {
    const cookie = await registerAndGetRefreshCookie('b');
    await request(server())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    await request(server())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('3: two refresh tokens issued within the same second still have distinct jti (and thus distinct tokens)', async () => {
    const cookie = await registerAndGetRefreshCookie('c');
    const secondRes = await request(server())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    const secondCookie = extractRefreshCookie(secondRes);

    const firstToken = cookie.split('=')[1];
    const secondToken = secondCookie.split('=')[1];
    expect(secondToken).not.toBe(firstToken);

    const firstPayload = jwtService.decode<{ jti?: string }>(firstToken);
    const secondPayload = jwtService.decode<{ jti?: string }>(secondToken);
    expect(firstPayload.jti).toBeDefined();
    expect(secondPayload.jti).toBeDefined();
    expect(firstPayload.jti).not.toBe(secondPayload.jti);
  });

  it('4: an expired refresh token is rejected', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email: `rt_student_d_${suffix}@test.dev`,
        password: 'password123',
        fullName: 'Student d',
      })
      .expect(201);
    const { accessToken } = body<TokenBody>(res);
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
      .set('Cookie', `refreshToken=${expiredToken}`)
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
      .set('Cookie', `refreshToken=${forgedToken}`)
      .expect(401);
  });

  it('6: logout revokes the exact refresh token used, and only that one', async () => {
    const cookie = await registerAndGetRefreshCookie('e');
    await request(server())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);
    await request(server())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('7: concurrent refresh calls with the same token do not both succeed (no token cloning)', async () => {
    const cookie = await registerAndGetRefreshCookie('f');

    const [resA, resB] = await Promise.all([
      request(server()).post('/auth/refresh').set('Cookie', cookie),
      request(server()).post('/auth/refresh').set('Cookie', cookie),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Đúng một request thành công (200), request còn lại phải bị từ chối (401) -
    // nếu cả hai đều 200 nghĩa là token gốc bị "nhân bản" thành hai phiên hợp lệ.
    expect(statuses).toEqual([200, 401]);
  });
});
