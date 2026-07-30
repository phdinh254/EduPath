# P1 Correctness & Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 6 P1 correctness/security gaps from the latest EduPath backend review, in the order requested: email normalization, inactive-account login, OAuth state hardening, OAuth exchange code storage, query enum validation, and question/exam structural validation.

**Architecture:** No new services or infrastructure beyond Task 4 (OAuth exchange codes move from an in-process `Map` to Redis, reusing the `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` config already used by BullMQ). Everything else is a targeted change inside existing NestJS modules.

**Tech Stack:** NestJS 11, class-validator/class-transformer, Prisma 7, ioredis (new explicit dependency — currently only pulled in transitively via `bullmq`), Jest + Supertest (e2e).

## Global Constraints

- Keep all in-repo comments in Vietnamese, matching existing style.
- `npm run test`, `npm run test:e2e`, and `npx eslint "{src,apps,libs,test}/**/*.ts"` (run from `backend/`) must pass before each commit.
- Google OAuth is unreachable in the e2e environment (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` unset → `GoogleConfiguredGuard` returns 503 before any handler runs — see `backend/src/auth/guards/google-configured.guard.ts`). Tasks 1c, 3, and 4 therefore need focused unit tests with mocked `req`/`res`/Redis client, not e2e coverage.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/auth/dto/register.dto.ts`, `login.dto.ts` | Trim+lowercase email before validation |
| `backend/src/auth/strategies/google.strategy.ts` | Trim+lowercase email from Google profile |
| `backend/src/auth/auth.service.ts` | Reject login for `isActive=false` accounts |
| `backend/src/auth/oauth-state.store.ts` | Bind OAuth state to a browser-held cookie; single-use (anti-replay) |
| `backend/src/auth/oauth-exchange.service.ts` | Move exchange-code storage from in-memory `Map` to Redis |
| `backend/package.json` | Add explicit `ioredis` dependency |
| `backend/src/users/users.controller.ts`, `backend/src/questions/questions.controller.ts`, `backend/src/roadmap/roadmap.controller.ts` | Validate `role`/`status` query params via `ParseEnumPipe` (400 instead of a Prisma 500) |
| `backend/src/questions/questions.service.ts` | Extend structural validation to `MULTIPLE_CHOICE`/`SHORT_ANSWER` at manual creation |
| `backend/src/exams/exams.service.ts` | Reject publishing a `DGNL` exam with an empty section |

---

## Task 1: Normalize email across register/login/Google OAuth

**Files:**
- Modify: `backend/src/auth/dto/register.dto.ts`
- Modify: `backend/src/auth/dto/login.dto.ts`
- Modify: `backend/src/auth/strategies/google.strategy.ts:40-56`
- Test: `backend/test/flows.e2e-spec.ts` (new test)

**Interfaces:** none new — `RegisterDto.email`/`LoginDto.email` still typed `string`, just normalized before `class-validator` runs (global `ValidationPipe({ transform: true })` in `backend/src/main.ts:39` applies `class-transformer` decorators before validating).

- [ ] **Step 1: Normalize in the DTOs**

In `backend/src/auth/dto/register.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Đăng ký công khai luôn tạo tài khoản STUDENT — không nhận role từ client.
// Tài khoản ADMIN chỉ được tạo trực tiếp trong DB (không có luồng tự đăng ký).
export class RegisterDto {
  // Chuẩn hoá TRƯỚC khi validate/so khớp DB — "User@Test.dev" và
  // " user@test.dev " phải được coi là cùng một tài khoản, không tạo được
  // hai bản ghi khác nhau cho cùng một email.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MaxLength(200)
  fullName: string;
}
```

In `backend/src/auth/dto/login.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}
```

- [ ] **Step 2: Normalize the Google OAuth profile email**

In `backend/src/auth/strategies/google.strategy.ts`, replace the `validate` method body:

```ts
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    // Chuẩn hoá giống RegisterDto/LoginDto — email từ Google profile không đi
    // qua ValidationPipe/DTO nên phải tự trim+lowercase ở đây để khớp với tài
    // khoản đã đăng ký bằng mật khẩu dùng cùng email nhưng khác hoa/thường.
    const rawEmail = profile.emails?.[0]?.value;
    const email = rawEmail?.trim().toLowerCase();
    if (!email) {
      done(new Error('Tài khoản Google không có email công khai'), false);
      return;
    }
    const user: GoogleProfile = {
      email,
      fullName: profile.displayName || email,
    };
    done(null, user);
  }
```

- [ ] **Step 3: Add an e2e test proving case-insensitive register/login**

In `backend/test/flows.e2e-spec.ts`, add a new test after test `10` (before the closing `});` of the `describe` block):

```ts

  it('11: email is normalized (trim+lowercase) for register and login', async () => {
    const rawEmail = `  Student11_${suffix}@Test.DEV  `;
    await request(server())
      .post('/auth/register')
      .send({
        email: rawEmail,
        password: 'password123',
        fullName: 'Student Eleven',
      })
      .expect(201);

    // Đăng ký lần 2 với cùng email nhưng khác hoa/thường + khoảng trắng phải
    // bị coi là trùng (409), không tạo được tài khoản thứ hai.
    await request(server())
      .post('/auth/register')
      .send({
        email: `student11_${suffix}@test.dev`,
        password: 'password123',
        fullName: 'Student Eleven Duplicate',
      })
      .expect(409);

    // Đăng nhập lại bằng biến thể hoa/thường + khoảng trắng khác phải thành công.
    await request(server())
      .post('/auth/login')
      .send({
        email: `STUDENT11_${suffix}@test.dev`,
        password: 'password123',
      })
      .expect(200);
  });
```

- [ ] **Step 4: Run it**

Run: `npx jest --config ./test/jest-e2e.json -t "11: email is normalized"` (from `backend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/dto/register.dto.ts backend/src/auth/dto/login.dto.ts backend/src/auth/strategies/google.strategy.ts backend/test/flows.e2e-spec.ts
git commit -m "fix(auth): normalize email (trim+lowercase) across register/login/Google OAuth"
```

---

## Task 2: Reject login for inactive accounts

**Files:**
- Modify: `backend/src/auth/auth.service.ts:61-87`
- Test: `backend/test/flows.e2e-spec.ts` (new test)

**Interfaces:** none new.

- [ ] **Step 1: Add the check**

In `backend/src/auth/auth.service.ts`, the `login` method currently ends with:

```ts
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return this.buildTokens(user.id, user.email, user.role);
  }
```

Replace it with:

```ts
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Kiểm tra SAU khi xác nhận mật khẩu đúng (không phải trước) — khớp cách
    // loginWithGoogle()/refresh() đã làm, và tránh lộ qua thông báo lỗi khác
    // nhau việc một email có tồn tại tài khoản bị vô hiệu hoá hay không.
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }
    return this.buildTokens(user.id, user.email, user.role);
  }
```

- [ ] **Step 2: Add an e2e test**

In `backend/test/flows.e2e-spec.ts`, add after test `11` (uses `PrismaService` — already imported via `createTestApp`'s `app.get(PrismaService)` pattern used in `test/utils.ts`; get it the same way here):

```ts

  it('12: a deactivated account cannot log in', async () => {
    const email = `student12_${suffix}@test.dev`;
    await request(server())
      .post('/auth/register')
      .send({ email, password: 'password123', fullName: 'Student Twelve' })
      .expect(201);

    const prisma = app.get(PrismaService);
    await prisma.user.update({ where: { email }, data: { isActive: false } });

    await request(server())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(401);
  });
```

Add the `PrismaService` import at the top of the file alongside the existing imports from `./utils`:

```ts
import { PrismaService } from '../src/prisma/prisma.service';
```

- [ ] **Step 3: Run it**

Run: `npx jest --config ./test/jest-e2e.json -t "12: a deactivated account"` (from `backend/`)
Expected: PASS

- [ ] **Step 4: Run the full e2e suite** (Task 1 and Task 2 both touch `flows.e2e-spec.ts`)

Run: `npm run test:e2e` (from `backend/`)
Expected: all tests PASS (18 total after Tasks 1-2).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/auth.service.ts backend/test/flows.e2e-spec.ts
git commit -m "fix(auth): reject login for deactivated (isActive=false) accounts"
```

---

## Task 3: Bind OAuth state to the initiating browser; make it single-use

**Files:**
- Modify: `backend/src/auth/oauth-state.store.ts`
- Test: Create `backend/src/auth/oauth-state.store.spec.ts`

**Interfaces:**
- Produces: same public shape (`store`/`verify` matching `passport-oauth2`'s `StateStore`), no consumers need to change (`backend/src/auth/strategies/google.strategy.ts:36` just instantiates it).

- [ ] **Step 1: Rewrite the store**

Replace the full contents of `backend/src/auth/oauth-state.store.ts`:

```ts
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

// Passport-oauth2 state store hoàn toàn stateless (không cần session/cookie
// riêng để TRA CỨU) — chống CSRF cho luồng Google OAuth bằng nonce ngẫu
// nhiên + timestamp ký HMAC, tự xác minh chữ ký và hạn dùng ở bước callback
// thay vì phải tra một session server-side. Phù hợp với kiến trúc hiện tại
// (JWT thuần, không có express-session).
//
// Chỉ ký HMAC là CHƯA đủ: một state hợp lệ có thể bị đánh cắp qua URL/log và
// dùng lại (replay) bởi một trình duyệt khác trước khi hết hạn — kẻ tấn công
// có thể ép nạn nhân hoàn tất luồng OAuth bằng session của kẻ tấn công (OAuth
// login CSRF). Để chặn: khi store() cấp state, đồng thời đặt một cookie
// HttpOnly ngẫu nhiên riêng trên chính trình duyệt đó; verify() chỉ chấp
// nhận state nếu giá trị nhúng trong state khớp với cookie đọc được từ CHÍNH
// request đó — trình duyệt của kẻ tấn công không có cookie này. Cookie luôn
// bị xoá ngay khi verify() chạy (dù thành công hay thất bại) nên state không
// thể tái sử dụng được lần thứ hai (chống replay).
const STATE_TTL_MS = 5 * 60_000;
const BINDING_COOKIE_NAME = 'oauth_state_binding';
// Phải là prefix chung của cả /auth/google (nơi đặt cookie) và
// /auth/google/callback (nơi đọc lại) để trình duyệt gửi kèm cookie ở bước
// callback — xem AuthController.REFRESH_COOKIE_PATH cho quy ước tương tự.
const BINDING_COOKIE_PATH = '/api/auth/google';

type StoreCallback = (err: Error | null, state: string) => void;
type VerifyCallback = (err: Error | null, ok: boolean, info?: unknown) => void;

export class StatelessOAuthStateStore {
  constructor(private readonly secret: string) {}

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  store(req: Request, callback: StoreCallback): void;
  store(req: Request, meta: unknown, callback: StoreCallback): void;
  store(
    req: Request,
    metaOrCallback: unknown,
    maybeCallback?: StoreCallback,
  ): void {
    const callback = (maybeCallback ?? metaOrCallback) as StoreCallback;
    const nonce = randomBytes(16).toString('hex');
    const browserBinding = randomBytes(16).toString('hex');
    const issuedAt = Date.now().toString();
    const payload = `${nonce}.${issuedAt}.${browserBinding}`;

    // Express luôn gán req.res <-> res.req cho nhau trong vòng đời một
    // request thật (xem Express Application#handle) — an toàn khi truy cập
    // trực tiếp ở đây, khác với việc phải nhận res qua tham số (StateStore
    // API của passport-oauth2 không truyền res vào store()/verify()).
    req.res?.cookie(BINDING_COOKIE_NAME, browserBinding, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
      path: BINDING_COOKIE_PATH,
    });

    callback(null, `${payload}.${this.sign(payload)}`);
  }

  verify(req: Request, state: string, callback: VerifyCallback): void;
  verify(
    req: Request,
    state: string,
    meta: unknown,
    callback: VerifyCallback,
  ): void;
  verify(
    req: Request,
    state: string,
    metaOrCallback: unknown,
    maybeCallback?: VerifyCallback,
  ): void {
    const callback = (maybeCallback ?? metaOrCallback) as VerifyCallback;
    const parts = typeof state === 'string' ? state.split('.') : [];

    // Xoá cookie binding NGAY LẬP TỨC, không phụ thuộc kết quả xác minh bên
    // dưới — đảm bảo mỗi cookie chỉ dùng thử được đúng một lần (chống replay
    // kể cả với chính trình duyệt hợp lệ).
    req.res?.clearCookie(BINDING_COOKIE_NAME, { path: BINDING_COOKIE_PATH });

    if (parts.length !== 4) {
      callback(null, false, 'state không đúng định dạng');
      return;
    }
    const [nonce, issuedAt, browserBinding, signature] = parts;
    const expected = this.sign(`${nonce}.${issuedAt}.${browserBinding}`);
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      callback(null, false, 'state không hợp lệ');
      return;
    }
    if (Date.now() - Number(issuedAt) > STATE_TTL_MS) {
      callback(null, false, 'state đã hết hạn');
      return;
    }

    const cookieBinding = (req.cookies as Record<string, string> | undefined)?.[
      BINDING_COOKIE_NAME
    ];
    if (!cookieBinding || cookieBinding !== browserBinding) {
      callback(null, false, 'state không khớp trình duyệt khởi tạo');
      return;
    }

    callback(null, true);
  }
}
```

- [ ] **Step 2: Write the unit test**

Create `backend/src/auth/oauth-state.store.spec.ts`:

```ts
import { StatelessOAuthStateStore } from './oauth-state.store';

function makeReq(cookies: Record<string, string> = {}) {
  const cookieJar = new Map<string, string>();
  const res = {
    cookie: jest.fn((name: string, value: string) => {
      cookieJar.set(name, value);
    }),
    clearCookie: jest.fn(),
  };
  return { req: { cookies, res } as never, res, cookieJar };
}

describe('StatelessOAuthStateStore', () => {
  const store = new StatelessOAuthStateStore('test-secret');

  function issueState(): { state: string; browserCookie: string } {
    const { req, cookieJar } = makeReq();
    let issuedState = '';
    store.store(req, (_err, state) => {
      issuedState = state;
    });
    const browserCookie = [...cookieJar.values()][0];
    return { state: issuedState, browserCookie };
  }

  it('verifies a state whose cookie matches the browser that requested it', () => {
    const { state, browserCookie } = issueState();
    const { req } = makeReq({ oauth_state_binding: browserCookie });

    let ok = false;
    store.verify(req, state, (_err, result) => {
      ok = result;
    });

    expect(ok).toBe(true);
  });

  it('rejects a state replayed without the matching browser cookie (stolen state, different browser)', () => {
    const { state } = issueState();
    const { req } = makeReq(); // no cookie at all — different browser

    let ok = true;
    let info: unknown;
    store.verify(req, state, (_err, result, i) => {
      ok = result;
      info = i;
    });

    expect(ok).toBe(false);
    expect(info).toBe('state không khớp trình duyệt khởi tạo');
  });

  it('rejects a state replayed a second time even with the original cookie (single-use)', () => {
    const { state, browserCookie } = issueState();
    const { req: req1 } = makeReq({ oauth_state_binding: browserCookie });
    store.verify(req1, state, () => {});

    // Cookie đã bị clearCookie() ở lần verify đầu — mô phỏng lần thử lại
    // bằng cách KHÔNG còn cookie trong request thứ hai.
    const { req: req2 } = makeReq();
    let ok = true;
    store.verify(req2, state, (_err, result) => {
      ok = result;
    });

    expect(ok).toBe(false);
  });

  it('rejects a tampered state (signature mismatch)', () => {
    const { state, browserCookie } = issueState();
    const tampered = state.slice(0, -1) + (state.at(-1) === 'a' ? 'b' : 'a');
    const { req } = makeReq({ oauth_state_binding: browserCookie });

    let ok = true;
    store.verify(req, tampered, (_err, result) => {
      ok = result;
    });

    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx jest oauth-state.store.spec` (from `backend/`)
Expected: 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/oauth-state.store.ts backend/src/auth/oauth-state.store.spec.ts
git commit -m "fix(auth): bind OAuth state to the initiating browser, make it single-use"
```

---

## Task 4: Move OAuth exchange codes from in-memory Map to Redis

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/auth/oauth-exchange.service.ts`
- Modify: `backend/src/auth/auth.module.ts` (check Redis config wiring)
- Test: Create `backend/src/auth/oauth-exchange.service.spec.ts`

**Interfaces:**
- Produces: same public shape (`create(accessToken, refreshToken): string`, `redeem(code): {accessToken,refreshToken}|null`) — `AuthController` (`backend/src/auth/auth.controller.ts:143,173`) does not change.

- [ ] **Step 1: Add `ioredis` as an explicit dependency**

In `backend/package.json`, `dependencies`, insert alphabetically after `"helmet": "^8.3.0",`:

```json
    "helmet": "^8.3.0",
    "ioredis": "^5.11.1",
    "joi": "^18.2.3",
```

Run: `npm install` (from `backend/`)
Expected: `ioredis` moves from a transitive (bullmq) dependency to a direct one in `package-lock.json`; no version change since it's already resolved to `5.11.1` elsewhere in the tree.

- [ ] **Step 2: Rewrite the service to use Redis**

Replace the full contents of `backend/src/auth/oauth-exchange.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Google trả về accessToken/refreshToken qua googleCallback() bằng một
// redirect trình duyệt (GET) — không thể đặt token thẳng vào query string vì
// URL bị log ở proxy/trình duyệt/lịch sử. Thay vào đó: cấp một mã dùng MỘT
// LẦN, sống rất ngắn, để frontend đổi lấy token thật qua POST
// /auth/oauth/exchange (xem AuthController).
//
// Lưu trong Redis (không còn Map trong bộ nhớ tiến trình) — một Map chỉ sống
// được khi backend chạy đúng 1 instance; chạy nhiều instance sau load
// balancer (scale ngang) thì request tạo mã và request đổi mã có thể rơi vào
// hai tiến trình khác nhau, khiến đổi mã luôn thất bại "ngẫu nhiên" tuỳ
// instance nào nhận request. Redis dùng chung giữa mọi instance giải quyết
// việc này, và TTL tự nhiên của Redis thay cho việc tự quét dọn mã hết hạn.
interface ExchangeEntry {
  accessToken: string;
  refreshToken: string;
}

const CODE_TTL_SECONDS = 60;
const KEY_PREFIX = 'oauth-exchange:';

@Injectable()
export class OAuthExchangeService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(config.get<string>('REDIS_PORT') ?? 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    });
  }

  async create(accessToken: string, refreshToken: string): Promise<string> {
    const code = randomUUID();
    const entry: ExchangeEntry = { accessToken, refreshToken };
    await this.redis.set(
      `${KEY_PREFIX}${code}`,
      JSON.stringify(entry),
      'EX',
      CODE_TTL_SECONDS,
    );
    return code;
  }

  // Dùng một lần: GETDEL đọc và xoá nguyên tử trong một round-trip — hai
  // request đổi cùng một mã gần như đồng thời (double-click, tab kép) không
  // thể cả hai cùng đọc thành công như khi tách GET rồi DEL riêng.
  async redeem(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const raw = await this.redis.getdel(`${KEY_PREFIX}${code}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as ExchangeEntry;
    return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
```

- [ ] **Step 3: Update the controller call sites for the now-async methods**

In `backend/src/auth/auth.controller.ts`, `googleCallback` currently does:

```ts
    const code = this.oauthExchange.create(
      tokens.accessToken,
      tokens.refreshToken,
    );
```

Change to:

```ts
    const code = await this.oauthExchange.create(
      tokens.accessToken,
      tokens.refreshToken,
    );
```

(The method is already `async googleCallback(...)`, so `await` is valid here — no signature change needed.)

`exchangeOAuthCode` currently is synchronous:

```ts
  exchangeOAuthCode(
    @Body() dto: OAuthExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = this.oauthExchange.redeem(dto.code);
```

Change to:

```ts
  async exchangeOAuthCode(
    @Body() dto: OAuthExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.oauthExchange.redeem(dto.code);
```

- [ ] **Step 4: Write the unit test**

Create `backend/src/auth/oauth-exchange.service.spec.ts`:

```ts
import { OAuthExchangeService } from './oauth-exchange.service';

describe('OAuthExchangeService', () => {
  let config: { get: jest.Mock };
  let service: OAuthExchangeService;

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new OAuthExchangeService(config as never);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('redeems a freshly created code exactly once', async () => {
    const code = await service.create('access-1', 'refresh-1');

    const first = await service.redeem(code);
    expect(first).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    const second = await service.redeem(code);
    expect(second).toBeNull();
  });

  it('returns null for an unknown code', async () => {
    const result = await service.redeem('does-not-exist');
    expect(result).toBeNull();
  });
});
```

This test requires a reachable Redis (same `localhost:6379` used by `npm run test:e2e` — see `backend/.env`). If Redis is unreachable, `ioredis`'s default `lazyConnect: false` retries in the background rather than throwing synchronously; `create`/`redeem` will hang until Redis is reachable. That matches how the rest of the app already depends on Redis being up (BullMQ registers its queue at bootstrap regardless of Gemini config — see `backend/src/grading/grading.module.ts`), so this test has the same environment requirement as `npm run test:e2e`, not a new one.

- [ ] **Step 5: Run it**

Run: `npx jest oauth-exchange.service.spec` (from `backend/`)
Expected: 2 tests PASS (requires local Redis — `docker compose -f devops/docker-compose.yml up -d redis` if not already running).

- [ ] **Step 6: Run lint and the full unit+e2e suite**

Run: `npx eslint "{src,apps,libs,test}/**/*.ts"` then `npm run test` then `npm run test:e2e` (from `backend/`)
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/auth/oauth-exchange.service.ts backend/src/auth/oauth-exchange.service.spec.ts backend/src/auth/auth.controller.ts
git commit -m "fix(auth): move OAuth exchange codes from in-memory Map to Redis"
```

---

## Task 5: Validate `role`/`status` query params (400, not a Prisma 500)

**Files:**
- Modify: `backend/src/users/users.controller.ts:71-76`
- Modify: `backend/src/questions/questions.controller.ts:108-117`
- Modify: `backend/src/roadmap/roadmap.controller.ts:68-78`
- Test: `backend/test/flows.e2e-spec.ts` (new test)

**Interfaces:** none new — `ParseEnumPipe` is a built-in Nest pipe (`@nestjs/common`), already used nowhere else in this codebase but requires no new wiring.

- [ ] **Step 1: `users.controller.ts`**

Add `ParseEnumPipe` to the `@nestjs/common` import, then change:

```ts
  findAll(
    @Query('role') role: Role | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
```

to:

```ts
  findAll(
    @Query('role', new ParseEnumPipe(Role, { optional: true }))
    role: Role | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
```

- [ ] **Step 2: `questions.controller.ts`**

Add `ParseEnumPipe` to the `@nestjs/common` import, then change:

```ts
  findAll(
    @Query('status') status: ContentStatus | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
```

to:

```ts
  findAll(
    @Query('status', new ParseEnumPipe(ContentStatus, { optional: true }))
    status: ContentStatus | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
```

- [ ] **Step 3: `roadmap.controller.ts`**

Add `ParseEnumPipe` to the `@nestjs/common` import, then change:

```ts
  findMyRoadmap(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: RoadmapStatus,
  ) {
```

to:

```ts
  findMyRoadmap(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId?: string,
    @Query('status', new ParseEnumPipe(RoadmapStatus, { optional: true }))
    status?: RoadmapStatus,
  ) {
```

- [ ] **Step 4: Add an e2e test**

In `backend/test/flows.e2e-spec.ts`, add after test `12`:

```ts

  it('13: an invalid enum query param returns 400, not a raw Prisma error', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin13_${suffix}@test.dev`,
    );

    await request(server())
      .get('/users?role=NOT_A_REAL_ROLE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(server())
      .get('/questions?status=NOT_A_REAL_STATUS')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
```

- [ ] **Step 5: Run it**

Run: `npx jest --config ./test/jest-e2e.json -t "13: an invalid enum"` (from `backend/`)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/users/users.controller.ts backend/src/questions/questions.controller.ts backend/src/roadmap/roadmap.controller.ts backend/test/flows.e2e-spec.ts
git commit -m "fix(api): validate role/status query params, return 400 on invalid enum values"
```

---

## Task 6: Question structural validation for all types + DGNL empty-section publish guard

**Files:**
- Modify: `backend/src/questions/questions.service.ts:46-155`
- Modify: `backend/src/exams/exams.service.ts:70-90`
- Test: `backend/test/flows.e2e-spec.ts` (new tests)

**Interfaces:**
- Produces: `assertValidQuestionStructure(dto)` replacing `assertValidTrueFalse(dto)` (same call site, `QuestionsService.create`).

- [ ] **Step 1: Generalize the structural check for manually-created questions**

In `backend/src/questions/questions.service.ts`, the existing `isStructurallyValid` (used only for AI-generated questions) already encodes the exact per-type rules needed. Replace `assertValidTrueFalse`:

```ts
function assertValidTrueFalse(dto: {
  type: QuestionType;
  correctAnswer?: unknown;
}) {
  if (dto.type !== QuestionType.TRUE_FALSE) return;
  // Thang điểm lũy tiến (0.1/0.25/0.5/1) chỉ đúng chuẩn Bộ GD&ĐT khi câu có
  // đúng 4 ý — xem grading.utils.ts. Sai số ý sẽ âm thầm rơi về tính tuyến
  // tính, nên phải chặn ngay từ lúc tạo câu hỏi.
  const statements = (dto.correctAnswer as { statements?: unknown } | null)
    ?.statements;
  if (!Array.isArray(statements) || statements.length !== 4) {
    throw new BadRequestException(
      'Câu đúng/sai phải có đúng 4 ý (correctAnswer.statements)',
    );
  }
}
```

with:

```ts
// ADMIN tạo câu hỏi thủ công qua create() KHÔNG đi qua isStructurallyValid()
// (hàm đó chỉ áp dụng cho luồng AI sinh — xem generateBatch/
// processGenerateQuestionsJob), nên trước đây chỉ TRUE_FALSE được ràng buộc
// cấu trúc đáp án. Một câu MULTIPLE_CHOICE thiếu options hoặc correctAnswer
// .index ngoài khoảng, hay SHORT_ANSWER thiếu correctAnswer.value, vẫn được
// lưu — và chỉ vỡ ra khi học sinh làm bài, lúc grading.utils không chấm được.
// Ràng buộc ngay tại thời điểm tạo, cho MỌI loại câu hỏi.
function assertValidQuestionStructure(dto: {
  type: QuestionType;
  options?: unknown;
  correctAnswer?: unknown;
}) {
  if (dto.type === QuestionType.MULTIPLE_CHOICE) {
    const options = dto.options;
    const correct = (dto.correctAnswer as { index?: number } | null)?.index;
    const valid =
      Array.isArray(options) &&
      options.length >= 2 &&
      typeof correct === 'number' &&
      correct >= 0 &&
      correct < options.length;
    if (!valid) {
      throw new BadRequestException(
        'Câu trắc nghiệm cần ít nhất 2 lựa chọn (options) và correctAnswer.index hợp lệ trong khoảng đó',
      );
    }
    return;
  }
  if (dto.type === QuestionType.TRUE_FALSE) {
    // Thang điểm lũy tiến (0.1/0.25/0.5/1) chỉ đúng chuẩn Bộ GD&ĐT khi câu có
    // đúng 4 ý — xem grading.utils.ts. Sai số ý sẽ âm thầm rơi về tính tuyến
    // tính, nên phải chặn ngay từ lúc tạo câu hỏi.
    const statements = (dto.correctAnswer as { statements?: unknown } | null)
      ?.statements;
    if (!Array.isArray(statements) || statements.length !== 4) {
      throw new BadRequestException(
        'Câu đúng/sai phải có đúng 4 ý (correctAnswer.statements)',
      );
    }
    return;
  }
  if (dto.type === QuestionType.SHORT_ANSWER) {
    const value = (dto.correctAnswer as { value?: string } | null)?.value;
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(
        'Câu trả lời ngắn cần correctAnswer.value không rỗng',
      );
    }
    return;
  }
  // ESSAY: không có đáp án đúng cố định (chấm bởi AI/ADMIN) — không ràng
  // buộc gì thêm, khớp isStructurallyValid().
}
```

Update the call site in `create()`:

```ts
  create(user: JwtPayload, dto: CreateQuestionDto) {
    assertValidQuestionStructure(dto);
```

- [ ] **Step 2: Reject publishing a DGNL exam with an empty section**

In `backend/src/exams/exams.service.ts`, the `publish` method currently is:

```ts
  async publish(examId: string, user: JwtPayload) {
    this.assertAdminOnly(user);
    const exam = await this.findExamOrThrow(examId);
    if (exam.purpose !== ExamPurpose.OFFICIAL) {
      throw new BadRequestException(
        'Chỉ đề chính thức mới cần thao tác publish — đề luyện cá nhân tự sẵn sàng ngay khi tạo',
      );
    }
    const questionCount = await this.prisma.examQuestion.count({
      where: { examId },
    });
    if (questionCount === 0) {
      throw new BadRequestException(
        'Đề chưa có câu hỏi nào — thêm câu hỏi trước khi publish',
      );
    }
    return this.prisma.exam.update({
      where: { id: examId },
      data: { status: ExamPublishStatus.PUBLISHED },
    });
  }
```

Replace with:

```ts
  async publish(examId: string, user: JwtPayload) {
    this.assertAdminOnly(user);
    const exam = await this.findExamOrThrow(examId);
    if (exam.purpose !== ExamPurpose.OFFICIAL) {
      throw new BadRequestException(
        'Chỉ đề chính thức mới cần thao tác publish — đề luyện cá nhân tự sẵn sàng ngay khi tạo',
      );
    }
    const questionCount = await this.prisma.examQuestion.count({
      where: { examId },
    });
    if (questionCount === 0) {
      throw new BadRequestException(
        'Đề chưa có câu hỏi nào — thêm câu hỏi trước khi publish',
      );
    }

    // Đề ĐGNL gồm nhiều section theo môn (xem ExamSection) — một section
    // không có câu hỏi nào vẫn để questionCount tổng > 0 lọt qua kiểm tra ở
    // trên, nhưng học sinh sẽ gặp một phần đề trống khi làm bài. Chặn publish
    // cho tới khi mọi section đều có ít nhất 1 câu.
    if (exam.category === ExamCategory.DGNL) {
      const sections = await this.prisma.examSection.findMany({
        where: { examId },
        include: { _count: { select: { examQuestions: true } } },
      });
      const emptySection = sections.find((s) => s._count.examQuestions === 0);
      if (emptySection) {
        throw new BadRequestException(
          `Section "${emptySection.name}" chưa có câu hỏi nào — thêm câu hỏi trước khi publish`,
        );
      }
    }

    return this.prisma.exam.update({
      where: { id: examId },
      data: { status: ExamPublishStatus.PUBLISHED },
    });
  }
```

- [ ] **Step 3: Add e2e tests**

In `backend/test/flows.e2e-spec.ts`, add after test `13`:

```ts

  it('14: manual question creation validates structure for all question types, not just TRUE_FALSE', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin14_${suffix}@test.dev`,
    );
    const subjectRes = await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `QS${suffix}`, name: 'QS subject' })
      .expect(201);
    const subject = body<IdBody>(subjectRes);
    const topicRes = await request(server())
      .post(`/subjects/${subject.id}/topics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'QS topic' })
      .expect(201);
    const topic = body<IdBody>(topicRes);

    // MULTIPLE_CHOICE với correctAnswer.index ngoài khoảng options -> 400.
    await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: subject.id,
        topicId: topic.id,
        type: 'MULTIPLE_CHOICE',
        difficulty: 'KNOWLEDGE',
        content: 'bad mc',
        options: ['a', 'b'],
        correctAnswer: { index: 5 },
      })
      .expect(400);

    // SHORT_ANSWER thiếu correctAnswer.value -> 400.
    await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: subject.id,
        topicId: topic.id,
        type: 'SHORT_ANSWER',
        difficulty: 'KNOWLEDGE',
        content: 'bad short answer',
        correctAnswer: {},
      })
      .expect(400);
  });
```

- [ ] **Step 4: Run it**

Run: `npx jest --config ./test/jest-e2e.json -t "14: manual question creation"` (from `backend/`)
Expected: PASS.

- [ ] **Step 5: Run the full unit+e2e suite**

Run: `npm run test` then `npm run test:e2e` (from `backend/`)
Expected: all PASS (25 unit, 20 e2e after this plan's additions).

- [ ] **Step 6: Commit**

```bash
git add backend/src/questions/questions.service.ts backend/src/exams/exams.service.ts backend/test/flows.e2e-spec.ts
git commit -m "fix(content): validate question structure for all types, block publishing DGNL exams with empty sections"
```

---

## Self-Review Notes

- **Spec coverage:** all 6 requested items covered — Task 1 (email normalization), Task 2 (isActive login block), Task 3 (OAuth state browser-binding + anti-replay), Task 4 (OAuth exchange → Redis), Task 5 (enum query 400s), Task 6 (question structure + DGNL publish rule).
- **Placeholder scan:** none — every step has literal code or a literal shell command.
- **Type consistency:** `OAuthExchangeService.create`/`redeem` become `async` in Task 4 — Step 3 of that task updates both call sites in `auth.controller.ts` to `await` them. `assertValidQuestionStructure` (Task 6) replaces `assertValidTrueFalse` at its one call site in `QuestionsService.create`.
- **Scope note on Task 6:** the original review also mentioned "kiểm tra tổng điểm sections ĐGNL bằng 150 khi dùng cấu hình thủ công" — there is currently no API endpoint for manually creating/editing `ExamSection` rows (sections are only ever created by the AI `generateExam` DGNL flow, which already derives `maxScore` from `DgnlTemplate`), so that specific manual-configuration gap does not exist against the current API surface. The empty-section publish guard added here is the applicable, verifiable equivalent given what's actually reachable today.

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-07-30-p1-correctness-security.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
