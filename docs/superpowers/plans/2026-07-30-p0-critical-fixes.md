# P0 Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five P0 findings from the latest EduPath backend review: red e2e suite, IP-spoofable rate limiting, non-atomic exam submission, missing HTTPS in prod Compose, and metrics/log exposure.

**Architecture:** No new services. Changes land inside the existing NestJS modular monolith (`backend/src`) plus the two `devops/` Compose files and `frontend/nginx.conf`. The submit-atomicity fix introduces one new Prisma model (`OutboxEvent`) and one new BullMQ queue/processor inside the existing `GradingModule` — no new infrastructure component.

**Tech Stack:** NestJS 11, Prisma 7 (Postgres), BullMQ/Redis, Jest + Supertest (e2e), Docker Compose, Nginx, Caddy (new, for TLS termination).

## Global Constraints

- Keep all in-repo comments in Vietnamese, matching existing style (see any file touched below for tone/voice).
- Every DB write that must survive a crash/restart goes through Prisma; never hold state only in process memory.
- Do not weaken `ValidationPipe`, `JwtAuthGuard`, or `RolesGuard` global wiring in `src/app.module.ts` while touching it.
- `npm run test`, `npm run test:e2e`, and `npx eslint "{src,apps,libs,test}/**/*.ts"` (run from `backend/`) must pass before each commit — this is what CI (`.github/workflows/ci.yml`) runs.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/test/flows.e2e-spec.ts` | Publish exams before starting attempts; new test asserting DRAFT exams block attempts |
| `backend/src/main.ts` | Configure Express `trust proxy` |
| `backend/src/config/env.validation.ts` | New `TRUST_PROXY_HOPS` env var |
| `backend/src/common/guards/app-throttler.guard.ts` (new) | Rate-limit tracker combining IP + normalized email |
| `backend/src/app.module.ts` | Swap global `ThrottlerGuard` for the new guard |
| `frontend/nginx.conf` | Block `/api/metrics` from external access |
| `backend/src/common/middleware/request-logging.middleware.ts` | Stop logging query strings; log level by status code |
| `backend/prisma/schema.prisma` + new migration | `OutboxEvent` model backing atomic essay-grading dispatch |
| `backend/src/grading/grading-queue.constants.ts` | Add `essayJobId()` helper, `OUTBOX_SWEEP_QUEUE` constant |
| `backend/src/grading/grading.service.ts` | Wrap `submitAttempt` writes in a transaction; dispatch essay grading via outbox |
| `backend/src/grading/grading.service.spec.ts` | Update mocks for `$transaction` + outbox |
| `backend/src/grading/outbox-sweep.processor.ts` (new) | Recurring recovery job for stuck outbox rows / stuck `SUBMITTED` attempts |
| `backend/src/grading/grading.module.ts` | Register the sweep queue/processor |
| `devops/docker-compose.prod.yml` | Add Caddy for TLS termination, drop hardcoded Postgres password |
| `devops/Caddyfile` (new) | HTTPS + HTTP→HTTPS redirect + HSTS + reverse proxy to `frontend` |
| `devops/.env.prod.example` (new) | `DOMAIN` / `POSTGRES_PASSWORD` placeholders for prod Compose |

---

## Task 1: e2e — publish exams before starting attempts

**Files:**
- Modify: `backend/test/flows.e2e-spec.ts:137-171` (test `3-4`)
- Modify: `backend/test/flows.e2e-spec.ts:347-372` (test `8`)

**Interfaces:**
- Consumes: existing `POST /exams/:id/publish` endpoint (`backend/src/exams/exams.controller.ts:144-154`), requires ADMIN token, requires the exam to already have ≥1 question, returns the updated exam (status 201).

- [ ] **Step 1: Insert the publish call in test `3-4`, right after the exam question is added and before the student starts an attempt**

In `backend/test/flows.e2e-spec.ts`, between the existing block that adds the question to the exam (ends at line 141 `.expect(201);`) and the comment `// Bất kỳ học sinh nào cũng truy cập được đề đã tồn tại...` (line 143), insert:

```ts
    // Đề mới tạo thủ công luôn bắt đầu ở DRAFT (xem exams.controller.ts) —
    // phải publish trước khi học sinh có thể bắt đầu làm bài.
    await request(server())
      .post(`/exams/${exam.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

```

- [ ] **Step 2: Insert the same publish call in test `8`, after both questions are added and before the student starts an attempt**

Between the second `POST /exams/${exam.id}/questions` call (ends at line 366 `.expect(201);`) and the comment `// Trả lời sai cả hai câu...` (line 368... offsets shift after Step 1, locate by the surrounding text instead of line numbers), insert the same block:

```ts
    await request(server())
      .post(`/exams/${exam.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

```

- [ ] **Step 3: Run the e2e suite and confirm tests `3-4` and `8` pass**

Run: `npm run test:e2e` (from `backend/`)
Expected: tests `3-4` and `8` PASS (they were failing with 404 on `POST /exams/:id/attempts` before this change, since `startAttempt` calls `assertVisibleOrNotFound` which 404s any non-owner/non-admin against a DRAFT exam — see `backend/src/exams/exams.service.ts:106-121`).

- [ ] **Step 4: Commit**

```bash
git add backend/test/flows.e2e-spec.ts
git commit -m "test(e2e): publish exams before students start attempts"
```

---

## Task 2: e2e — new test asserting a DRAFT exam blocks attempts

**Files:**
- Modify: `backend/test/flows.e2e-spec.ts` (add a new `it(...)` block, e.g. numbered `10`, right before the closing `});` of the `describe('Core flows (e2e)', ...)` block)

**Interfaces:**
- Consumes: `registerFactory`/`adminFactory`/`body`/`IdBody` already imported at the top of the file.

- [ ] **Step 1: Write the test**

Add at the end of the `describe` block, after test `9` and before the final `});`:

```ts

  it('10: a DRAFT exam cannot be started by a student (404) until published', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin10_${suffix}@test.dev`,
    );
    const { accessToken: studentToken } = await register({
      email: `student10_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Ten',
    });

    const subjectRes = await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `DRAFT${suffix}`, name: 'Draft subject' })
      .expect(201);
    const subject = body<IdBody>(subjectRes);
    const topicRes = await request(server())
      .post(`/subjects/${subject.id}/topics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Draft topic' })
      .expect(201);
    const topic = body<IdBody>(topicRes);
    const questionRes = await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: subject.id,
        topicId: topic.id,
        type: 'MULTIPLE_CHOICE',
        difficulty: 'KNOWLEDGE',
        content: 'draft question',
        options: ['a', 'b'],
        correctAnswer: { index: 1 },
      })
      .expect(201);
    const question = body<IdBody>(questionRes);

    const examRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Draft exam', subjectId: subject.id, durationMinutes: 10 })
      .expect(201);
    const exam = body<IdBody>(examRes);
    await request(server())
      .post(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: question.id, order: 1, maxScore: 0.25 })
      .expect(201);

    // Chưa publish — học sinh không thấy đề này tồn tại.
    await request(server())
      .post(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);

    // ADMIN vẫn thấy được đề DRAFT của mình (để tiếp tục soạn).
    await request(server())
      .get(`/exams/${exam.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
```

- [ ] **Step 2: Run it**

Run: `npx jest --config ./test/jest-e2e.json -t "10: a DRAFT exam"` (from `backend/`)
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/flows.e2e-spec.ts
git commit -m "test(e2e): assert DRAFT exams cannot be started by students"
```

---

## Task 3: Configure `trust proxy` so rate limiting sees real client IPs

**Files:**
- Modify: `backend/src/config/env.validation.ts`
- Modify: `backend/src/main.ts:16-20`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `ConfigService.get<number>('TRUST_PROXY_HOPS')`, used by Task 3 and read again nowhere else in this plan.

- [ ] **Step 1: Add the env var to the validation schema**

In `backend/src/config/env.validation.ts`, after the `PORT` line:

```ts
  PORT: Joi.number().port().default(3000),

  // Số hop reverse proxy đứng trước backend mà ta TIN để đọc IP client thật
  // từ X-Forwarded-For (xem main.ts) — mặc định 1 khớp kiến trúc hiện tại
  // (chỉ Nginx đứng trước, xem devops/docker-compose.prod.yml). Sai số này
  // theo hướng thấp là an toàn hơn (rate limit vẫn áp đúng theo IP Nginx thay
  // vì bị spoof), nhưng phải tăng lên nếu thêm một reverse proxy/LB nữa phía
  // trước Nginx (ví dụ Caddy làm TLS termination — xem Task 11).
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(1),
```

- [ ] **Step 2: Set it in `main.ts`**

In `backend/src/main.ts`, after line 20 (`const isProduction = ...`):

```ts
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Nginx (và, khi bật HTTPS, Caddy đứng trước Nginx — xem devops/Caddyfile)
  // là (các) reverse proxy DUY NHẤT phép tin — nếu không khai báo, Express
  // coi socket kết nối trực tiếp (luôn là Nginx trong container) là "client",
  // nên req.ip là IP nội bộ của Nginx cho MỌI người dùng thật. ThrottlerGuard
  // (xem AppThrottlerGuard) dựa vào req.ip, nên hậu quả là rate limit áp dụng
  // DÙNG CHUNG một bộ đếm cho toàn bộ traffic production — 5 request đăng
  // ký/đăng nhập của BẤT KỲ ai trong 1 phút khoá tạm luôn cả những người khác.
  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS'));
```

- [ ] **Step 3: Document the new var**

In `backend/.env.example`, after the `PORT=3000` line:

```
PORT=3000

# Số hop reverse proxy tin để đọc IP client thật (xem TRUST_PROXY_HOPS trong
# env.validation.ts) — 1 khi chỉ có Nginx đứng trước (mặc định), 2 nếu có
# thêm Caddy/LB làm TLS termination phía trước Nginx.
TRUST_PROXY_HOPS=1
```

- [ ] **Step 4: Verify the app still boots and unit tests still pass**

Run: `npm run test` (from `backend/`)
Expected: PASS (no test references `TRUST_PROXY_HOPS`, this is a smoke check that `env.validation.ts` still parses)

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/env.validation.ts backend/src/main.ts backend/.env.example
git commit -m "fix(security): trust the reverse proxy hop count for client IP resolution"
```

---

## Task 4: Rate-limit tracker combines IP + normalized email

**Files:**
- Create: `backend/src/common/guards/app-throttler.guard.ts`
- Modify: `backend/src/app.module.ts:1-4,66-68`

**Interfaces:**
- Produces: `AppThrottlerGuard`, a drop-in replacement for `@nestjs/throttler`'s `ThrottlerGuard` used as the global `APP_GUARD`.

- [ ] **Step 1: Write the guard**

Create `backend/src/common/guards/app-throttler.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// ThrottlerGuard mặc định chỉ dùng req.ip làm tracker. Sau khi bật trust
// proxy (xem main.ts), req.ip đã là IP client thật — nhưng nhiều học sinh
// dùng chung một mạng trường học/NAT vẫn dùng chung một IP công cộng. Nếu
// chỉ dựa vào IP, 5 học sinh khác nhau đăng ký gần như đồng thời từ cùng
// trường có thể tự khoá lẫn nhau (xem P0 issue #2).
//
// Kết hợp thêm email đã chuẩn hoá (trim + lowercase) lấy từ body request khi
// có — hai người dùng khác email từ cùng IP không còn dùng chung một bộ đếm,
// trong khi một người/kẻ tấn công dò mật khẩu từ IP đó vào MỘT email cụ thể
// vẫn bị giới hạn đúng như trước. Route không có field email trong body (vd.
// hầu hết endpoint ngoài auth) rơi về đúng hành vi cũ (chỉ IP).
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = await super.getTracker(req);
    const email = (req as { body?: { email?: unknown } }).body?.email;
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    return normalizedEmail ? `${ip}:${normalizedEmail}` : ip;
  }
}
```

- [ ] **Step 2: Wire it in as the global guard**

In `backend/src/app.module.ts`, change the import:

```ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
```
to:
```ts
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
```

And change the provider:
```ts
    { provide: APP_GUARD, useClass: ThrottlerGuard },
```
to:
```ts
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
```

- [ ] **Step 3: Run the full e2e suite and confirm the pre-existing 429 flakiness is gone**

Run: `npm run test:e2e` (from `backend/`)
Expected: all tests PASS, including tests `5`, `6-7`, `9` which previously hit 429 (their `register()`/`makeAdmin()` calls each use a distinct `..._${suffix}@test.dev` email, so each now gets its own tracker bucket instead of sharing the suite's one IP-only bucket).

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/guards/app-throttler.guard.ts backend/src/app.module.ts
git commit -m "fix(security): key rate limiting on IP+email instead of IP alone"
```

---

## Task 5: Block `/api/metrics` at the Nginx edge

**Files:**
- Modify: `frontend/nginx.conf:29-36`

**Interfaces:** none (pure Nginx config).

- [ ] **Step 1: Add an exact-match block above the generic `/api/` proxy**

In `frontend/nginx.conf`, insert immediately before the existing `location /api/ {` block:

```nginx
    # /metrics là endpoint scrape Prometheus công khai ở tầng backend (không
    # yêu cầu JWT — xem backend/src/metrics/metrics.controller.ts) vì
    # Prometheus không gửi token. Nó CHỈ được coi an toàn vì lẽ ra không lộ ra
    # ngoài mạng Docker nội bộ — nhưng /api/ ở dưới reverse-proxy MỌI path
    # (kể cả /api/metrics -> backend:3000/metrics), nên phải chặn tường minh
    # ở đây trước khi rơi vào rule /api/ chung.
    location = /api/metrics {
        return 404;
    }

```

- [ ] **Step 2: Verify Nginx config syntax (requires Docker)**

Run: `docker run --rm -v "$(pwd)/frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t` (from repo root)
Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

- [ ] **Step 3: Commit**

```bash
git add frontend/nginx.conf
git commit -m "fix(security): block external access to /api/metrics"
```

---

## Task 6: Stop logging query strings; use warn/error by status code

**Files:**
- Modify: `backend/src/common/middleware/request-logging.middleware.ts`

**Interfaces:** none — this middleware has no test coverage today; verify manually per Step 2.

- [ ] **Step 1: Rewrite the `finish` handler**

Replace the body of `request-logging.middleware.ts` from `const startedAt = Date.now();` through the closing of the `res.on('finish', ...)` call with:

```ts
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
```

- [ ] **Step 2: Manually verify**

Run: `npm run start:dev` (from `backend/`), then in another terminal:
```bash
curl -i "http://localhost:3000/auth/google/callback?code=SECRET&state=abc"
curl -i http://localhost:3000/does-not-exist
```
Expected: server log lines show `"path":"/auth/google/callback"` with no `code=SECRET` anywhere, and the 404 line is logged via `logger.warn` (NestJS default log format shows `[HTTP] WARN` for warn-level vs `LOG` for log-level).

- [ ] **Step 3: Commit**

```bash
git add backend/src/common/middleware/request-logging.middleware.ts
git commit -m "fix(security): stop logging query strings, log 4xx as warn not log"
```

---

## Task 7: `OutboxEvent` Prisma model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_grading_outbox/migration.sql` (generated by Prisma CLI, not hand-written)

**Interfaces:**
- Produces: `prisma.outboxEvent` client methods (`create`, `findMany`, `updateMany`) and the `OutboxStatus` enum, consumed by Task 8 and Task 9.

- [ ] **Step 1: Add the enum and model**

In `backend/prisma/schema.prisma`, after the `enum AttemptStatus { ... }` block (ends around line 62), add:

```prisma
enum OutboxStatus {
  PENDING
  PROCESSED
}
```

Then, after the `model Answer { ... }` block (ends around line 439, right before `model ScoreOverride`), add:

```prisma
// Đảm bảo việc phát job chấm tự luận qua Redis/BullMQ sống sót qua lỗi
// Redis hoặc lỗi tiến trình xảy ra giữa lúc nộp bài — ghi trong CÙNG
// transaction với các upsert Answer khác (xem GradingService.submitAttempt),
// enqueue thật sự CHỈ sau khi transaction đó commit. jobId trùng với jobId
// BullMQ tương ứng nên OutboxSweepProcessor phát lại một sự kiện PENDING
// không bao giờ tạo job trùng (BullMQ tự chặn theo jobId).
model OutboxEvent {
  id          String       @id @default(cuid())
  jobId       String       @unique
  type        String
  payload     Json
  status      OutboxStatus @default(PENDING)
  createdAt   DateTime     @default(now())
  processedAt DateTime?

  @@index([status, createdAt])
}
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name grading_outbox` (from `backend/`, requires a reachable dev DB per `DATABASE_URL` in `backend/.env`)
Expected: creates `backend/prisma/migrations/<timestamp>_grading_outbox/migration.sql` containing `CREATE TYPE "OutboxStatus"` and `CREATE TABLE "OutboxEvent"`, applies cleanly, regenerates the Prisma client.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add OutboxEvent model for atomic essay-grading dispatch"
```

---

## Task 8: Make `submitAttempt` atomic; dispatch essay grading through the outbox

**Files:**
- Modify: `backend/src/grading/grading-queue.constants.ts`
- Modify: `backend/src/grading/grading.service.ts:182-308`
- Modify: `backend/src/grading/grading.service.spec.ts`

**Interfaces:**
- Consumes: `OutboxEvent`/`OutboxStatus` from Task 7.
- Produces: `GradingService.enqueueEssayGradingJob(jobData)` (private), `GradingService.recoverPendingOutboxEvents()` (public), `GradingService.recoverStuckSubmissions()` (public) — both consumed by Task 9's `OutboxSweepProcessor`. Also drops `private` from `recomputeScore` (now `async recomputeScore(...)`, no visibility modifier — TypeScript default is public), since `recoverStuckSubmissions` needs to call it.

- [ ] **Step 1: Add the `essayJobId` helper**

In `backend/src/grading/grading-queue.constants.ts`, add:

```ts
export const GRADE_ESSAY_QUEUE = 'grade-essay';

// jobId cố định (không random) — cho phép phát lại cùng một sự kiện outbox
// nhiều lần (từ OutboxSweepProcessor) mà không tạo job trùng, vì BullMQ tự
// bỏ qua add() thứ hai với cùng jobId khi job gốc còn tồn tại trong queue.
export function essayJobId(attemptId: string, questionId: string): string {
  return `grade-essay:${attemptId}:${questionId}`;
}

export interface GradeEssayJobData {
  attemptId: string;
  questionId: string;
  questionContent: string;
  maxScore: number;
}
```

- [ ] **Step 2: Rewrite `submitAttempt` to wrap DB writes in a transaction and defer the queue call**

In `backend/src/grading/grading.service.ts`, add `Prisma` and `OutboxStatus` to the `@prisma/client` import:

```ts
import { AttemptStatus, OutboxStatus, Prisma, QuestionType, Role } from '@prisma/client';
```

Add `essayJobId` to the `grading-queue.constants` import:

```ts
import {
  GRADE_ESSAY_QUEUE,
  essayJobId,
  type GradeEssayJobData,
} from './grading-queue.constants';
```

Replace the entire `submitAttempt` method (lines 182-308) with:

```ts
  async submitAttempt(attemptId: string, user: JwtPayload) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { examQuestions: { include: { question: true } } } },
        answers: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (attempt.studentId !== user.sub) {
      throw new ForbiddenException('Đây không phải lượt làm bài của bạn');
    }

    const answersByQuestionId = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );
    const pendingEssayJobs: GradeEssayJobData[] = [];

    // Toàn bộ khoá trạng thái (IN_PROGRESS -> SUBMITTED) + ghi điểm đồng bộ
    // chạy trong MỘT transaction — nếu DB/tiến trình lỗi giữa chừng, Postgres
    // tự rollback về IN_PROGRESS thay vì để attempt kẹt ở SUBMITTED với một
    // phần câu đã chấm, phần chưa (xem P0 issue #3). Job chấm tự luận KHÔNG
    // gọi Redis ở đây — chỉ ghi OutboxEvent trong cùng transaction; enqueue
    // thật sự diễn ra sau khi transaction commit (bên dưới), để một lỗi Redis
    // không kéo theo rollback các câu khác đã chấm xong.
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.examAttempt.updateMany({
        where: { id: attemptId, status: AttemptStatus.IN_PROGRESS },
        data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Lượt làm bài đã được nộp trước đó');
      }

      for (const eq of attempt.exam.examQuestions) {
        const existingAnswer = answersByQuestionId.get(eq.questionId);
        const response = existingAnswer?.response ?? null;

        if (eq.question.type === QuestionType.ESSAY) {
          const rawText = String(
            (response as { text?: string } | null)?.text ?? '',
          ).trim();
          if (!rawText || !this.gemini.isConfigured()) {
            // Bài trắng (luôn chấm 0 ngay, không cần AI) hoặc Gemini chưa cấu
            // hình (không có gì để xếp hàng chờ) — xử lý xong ngay tại đây.
            const outcome = gradeEssayFallback(
              response,
              'GEMINI_NOT_CONFIGURED',
            );
            const data = this.essayOutcomeToAnswerData(outcome);
            await tx.answer.upsert({
              where: {
                attemptId_questionId: { attemptId, questionId: eq.questionId },
              },
              create: {
                attemptId,
                questionId: eq.questionId,
                response: response ?? undefined,
                ...data,
              },
              update: data,
            });
            continue;
          }

          // Có nội dung thật + Gemini đã cấu hình — ghi skeleton câu trả lời
          // và một OutboxEvent trong transaction này; job BullMQ thật sự được
          // enqueue sau khi transaction commit (xem vòng lặp pendingEssayJobs
          // bên dưới).
          await tx.answer.upsert({
            where: {
              attemptId_questionId: { attemptId, questionId: eq.questionId },
            },
            create: {
              attemptId,
              questionId: eq.questionId,
              response: response ?? undefined,
            },
            update: {
              response: response ?? undefined,
              scoreAwarded: null,
              needsManualGrading: false,
              fallbackReason: null,
              gradingModel: null,
              gradingPromptVersion: null,
              gradedAt: null,
              aiComment: null,
              aiPreliminaryScore: null,
              isAiReferenceOnly: false,
            },
          });

          const jobData: GradeEssayJobData = {
            attemptId,
            questionId: eq.questionId,
            questionContent: eq.question.content,
            maxScore: eq.maxScore,
          };
          await tx.outboxEvent.create({
            data: {
              jobId: essayJobId(attemptId, eq.questionId),
              type: GRADE_ESSAY_QUEUE,
              payload: jobData as unknown as Prisma.InputJsonValue,
            },
          });
          pendingEssayJobs.push(jobData);
          continue;
        }

        const grader =
          eq.question.type === QuestionType.MULTIPLE_CHOICE
            ? gradeMultipleChoice
            : eq.question.type === QuestionType.TRUE_FALSE
              ? gradeTrueFalse
              : gradeShortAnswer;
        const { isCorrect, scoreAwarded } = grader(
          response,
          eq.question.correctAnswer,
          eq.maxScore,
        );

        await tx.answer.upsert({
          where: {
            attemptId_questionId: { attemptId, questionId: eq.questionId },
          },
          create: {
            attemptId,
            questionId: eq.questionId,
            response: response ?? undefined,
            isCorrect,
            scoreAwarded,
          },
          update: { isCorrect, scoreAwarded },
        });
      }
    });

    // Transaction đã commit — DB đã nhất quán dù bước enqueue dưới đây có lỗi
    // hay không. Nếu Redis tạm thời không tới được, OutboxEvent vẫn ở PENDING
    // và OutboxSweepProcessor (chạy định kỳ, xem outbox-sweep.processor.ts)
    // sẽ tự phát lại — học sinh không cần nộp lại bài.
    for (const jobData of pendingEssayJobs) {
      await this.enqueueEssayGradingJob(jobData);
    }

    return this.recomputeScore(attemptId);
  }

  private async enqueueEssayGradingJob(
    jobData: GradeEssayJobData,
  ): Promise<void> {
    const jobId = essayJobId(jobData.attemptId, jobData.questionId);
    try {
      await this.gradeEssayQueue.add('grade-essay', jobData, { jobId });
      await this.prisma.outboxEvent.updateMany({
        where: { jobId, status: OutboxStatus.PENDING },
        data: { status: OutboxStatus.PROCESSED, processedAt: new Date() },
      });
    } catch {
      // Redis lỗi/timeout — để nguyên PENDING, OutboxSweepProcessor sẽ phát
      // lại ở lượt quét kế tiếp. Không throw ra ngoài: DB đã nhất quán rồi,
      // học sinh không cần biết/không cần làm gì thêm.
    }
  }

  // Gọi định kỳ từ OutboxSweepProcessor — phát lại mọi OutboxEvent còn PENDING
  // quá `olderThanMs` (nghĩa là enqueueEssayGradingJob ở submitAttempt đã
  // từng thử và lỗi, hoặc tiến trình chết trước khi kịp gọi nó).
  async recoverPendingOutboxEvents(olderThanMs = 30_000): Promise<number> {
    const stale = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxStatus.PENDING,
        createdAt: { lt: new Date(Date.now() - olderThanMs) },
      },
      take: 100,
    });
    for (const event of stale) {
      if (event.type !== GRADE_ESSAY_QUEUE) continue;
      await this.enqueueEssayGradingJob(
        event.payload as unknown as GradeEssayJobData,
      );
    }
    return stale.length;
  }

  // Gọi định kỳ từ OutboxSweepProcessor — status=SUBMITTED nghĩa là
  // transaction chấm đồng bộ trong submitAttempt đã commit xong (mọi Answer
  // đã ghi đúng, mọi OutboxEvent cần thiết đã tồn tại); chỉ còn khả năng tiến
  // trình chết NGAY SAU khi transaction commit, trước khi kịp gọi
  // recomputeScore() ở cuối submitAttempt. Gọi lại recomputeScore() là an
  // toàn tuyệt đối vì nó chỉ ĐỌC lại Answer hiện có, không chấm lại gì cả.
  async recoverStuckSubmissions(olderThanMs = 5 * 60_000): Promise<number> {
    const stuck = await this.prisma.examAttempt.findMany({
      where: {
        status: AttemptStatus.SUBMITTED,
        submittedAt: { lt: new Date(Date.now() - olderThanMs) },
      },
      select: { id: true },
      take: 100,
    });
    for (const attempt of stuck) {
      await this.recomputeScore(attempt.id);
    }
    return stuck.length;
  }
```

- [ ] **Step 3: Drop `private` from `recomputeScore`**

In the same file, change:
```ts
  private async recomputeScore(attemptId: string) {
```
to:
```ts
  async recomputeScore(attemptId: string) {
```

- [ ] **Step 4: Update the unit test mocks for `$transaction` and outbox**

In `backend/src/grading/grading.service.spec.ts`, inside `makeService()`:

Add `outboxEvent` to the `prisma` mock object, and a `$transaction` mock that just invokes the callback with the same mock (interactive-transaction client shares the same method names as the top-level client, so existing assertions on e.g. `prisma.examAttempt.updateMany` keep working unchanged):

```ts
function makeService() {
  const prisma = {
    examAttempt: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    answer: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    score: { upsert: jest.fn() },
    outboxEvent: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
```

(Keep the rest of `makeService()` — `roadmapService`, `readinessService`, `gemini`, `gradeEssayQueue`, and the `new GradingService(...)` call/return — unchanged.)

- [ ] **Step 5: Update the essay-with-Gemini test to assert the outbox + jobId path**

In the test `'Gemini đã cấu hình + có nội dung — xếp hàng chấm nền, chưa gọi Gemini ngay, attempt chờ PENDING_REVIEW'`, replace:

```ts
    expect(gradeEssayQueue.add).toHaveBeenCalledWith('grade-essay', {
      attemptId: 'attempt-3',
      questionId: 'q-essay',
      questionContent: 'Đề bài Đọc hiểu + Viết',
      maxScore: 10,
    });
```

with:

```ts
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: 'grade-essay:attempt-3:q-essay',
        type: 'grade-essay',
        payload: {
          attemptId: 'attempt-3',
          questionId: 'q-essay',
          questionContent: 'Đề bài Đọc hiểu + Viết',
          maxScore: 10,
        },
      }),
    });
    expect(gradeEssayQueue.add).toHaveBeenCalledWith(
      'grade-essay',
      {
        attemptId: 'attempt-3',
        questionId: 'q-essay',
        questionContent: 'Đề bài Đọc hiểu + Viết',
        maxScore: 10,
      },
      { jobId: 'grade-essay:attempt-3:q-essay' },
    );
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { jobId: 'grade-essay:attempt-3:q-essay', status: 'PENDING' },
      data: { status: 'PROCESSED', processedAt: expect.any(Date) },
    });
```

- [ ] **Step 6: Run unit tests**

Run: `npm run test -- grading.service.spec` (from `backend/`)
Expected: all `GradingService` unit tests PASS.

- [ ] **Step 7: Run the full e2e suite**

Run: `npm run test:e2e` (from `backend/`)
Expected: PASS (test `6-7` still exercises the Gemini-not-configured fallback path, which is unchanged; the outbox path is only exercised when `GEMINI_API_KEY` is set, which it isn't in the e2e env).

- [ ] **Step 8: Commit**

```bash
git add backend/src/grading/grading-queue.constants.ts backend/src/grading/grading.service.ts backend/src/grading/grading.service.spec.ts
git commit -m "fix(grading): make submitAttempt atomic, dispatch essay grading via outbox"
```

---

## Task 9: Recovery sweep for stuck outbox events / stuck submissions

**Files:**
- Create: `backend/src/grading/outbox-sweep.processor.ts`
- Modify: `backend/src/grading/grading.module.ts`

**Interfaces:**
- Consumes: `GradingService.recoverPendingOutboxEvents()`, `GradingService.recoverStuckSubmissions()` from Task 8.

- [ ] **Step 1: Write the processor**

Create `backend/src/grading/outbox-sweep.processor.ts`:

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { GradingService } from './grading.service';

export const OUTBOX_SWEEP_QUEUE = 'outbox-sweep';
const SWEEP_INTERVAL_MS = 60_000;
// jobId cố định cho job lặp lại — add() lại với cùng jobId+repeat không tạo
// thêm lịch trùng, kể cả khi có nhiều instance backend cùng khởi động
// (Kubernetes/Compose scale > 1).
const SWEEP_JOB_ID = 'outbox-sweep-tick';

// Lưới an toàn cho GradingService.submitAttempt (xem P0 issue #3): quét định
// kỳ để phát lại OutboxEvent còn PENDING (Redis lỗi lúc submit) và finalize
// nốt các ExamAttempt kẹt ở SUBMITTED (tiến trình chết ngay sau khi
// transaction chấm điểm commit, trước khi kịp gọi recomputeScore()).
@Injectable()
@Processor(OUTBOX_SWEEP_QUEUE)
export class OutboxSweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OutboxSweepProcessor.name);

  constructor(
    private readonly gradingService: GradingService,
    @InjectQueue(OUTBOX_SWEEP_QUEUE) private readonly sweepQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.sweepQueue.add(
      'sweep',
      {},
      {
        jobId: SWEEP_JOB_ID,
        repeat: { every: SWEEP_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async process(): Promise<void> {
    const [outboxCount, stuckCount] = await Promise.all([
      this.gradingService.recoverPendingOutboxEvents(),
      this.gradingService.recoverStuckSubmissions(),
    ]);
    if (outboxCount > 0 || stuckCount > 0) {
      this.logger.warn(
        `Outbox sweep: phát lại ${outboxCount} job tự luận treo, khôi phục ${stuckCount} attempt kẹt ở SUBMITTED`,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(): void {
    this.logger.error(
      'Outbox sweep job thất bại — sẽ tự chạy lại ở lượt kế tiếp (60s)',
    );
  }
}
```

- [ ] **Step 2: Register the queue and processor**

In `backend/src/grading/grading.module.ts`, add imports:

```ts
import { OutboxSweepProcessor, OUTBOX_SWEEP_QUEUE } from './outbox-sweep.processor';
```

Add a second `BullModule.registerQueue(...)` entry inside the `imports: [...]` array's existing `BullModule.registerQueue({ name: GRADE_ESSAY_QUEUE, ... })` call — turn it into an array argument:

```ts
    BullModule.registerQueue(
      {
        name: GRADE_ESSAY_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      },
      { name: OUTBOX_SWEEP_QUEUE },
    ),
```

Add `OutboxSweepProcessor` to `providers`:

```ts
  providers: [GradingService, GradeEssayProcessor, OutboxSweepProcessor],
```

- [ ] **Step 3: Verify the app boots with the new queue registered**

Run: `npm run test:e2e` (from `backend/`)
Expected: PASS — this exercises full `AppModule` bootstrap including `GradingModule`, confirming `OutboxSweepProcessor`'s `onModuleInit` doesn't throw even without a real Redis available in the sandbox (mirrors the existing tolerance the suite already has for `GRADE_ESSAY_QUEUE`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/grading/outbox-sweep.processor.ts backend/src/grading/grading.module.ts
git commit -m "feat(grading): recover stuck essay-grading jobs and stuck submissions"
```

---

## Task 10: HTTPS termination for production Compose

**Files:**
- Create: `devops/Caddyfile`
- Create: `devops/.env.prod.example`
- Modify: `devops/docker-compose.prod.yml`

**Interfaces:** none (pure infra config).

- [ ] **Step 1: Write the Caddyfile**

Create `devops/Caddyfile`:

```
{$DOMAIN} {
	# Caddy tự lấy chứng chỉ Let's Encrypt cho DOMAIN, tự redirect HTTP->HTTPS,
	# và tự thêm header bảo mật cơ bản (không cần cấu hình tay như Nginx thuần).
	encode gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}

	reverse_proxy frontend:80
}
```

- [ ] **Step 2: Write the prod env example**

Create `devops/.env.prod.example`:

```
# Copy to devops/.env.prod and fill in real values. Never commit devops/.env.prod.

# Tên miền thật trỏ về máy chủ này (Caddy dùng để tự cấp/renew chứng chỉ
# Let's Encrypt qua HTTP-01/TLS-ALPN — cổng 80 và 443 phải mở ra Internet).
DOMAIN=example.com

# Mật khẩu Postgres thật — KHÔNG dùng giá trị mặc định "edupath" trong
# production (xem P0 issue #4).
POSTGRES_PASSWORD=change-me-to-a-real-random-password
```

- [ ] **Step 3: Update `docker-compose.prod.yml`**

Replace the `postgres` service's hardcoded password, and replace the `frontend` service's direct port exposure with a new `caddy` service in front of it. Full new file:

```yaml
# Compose profile dành cho production — khác docker-compose.yml (dev) ở 4 điểm:
# 1) build target "production" cho cả backend/frontend thay vì "dev" (không mount
#    source code, không hot-reload).
# 2) Chỉ Caddy mở cổng ra ngoài (80/443) — frontend/backend/postgres chỉ giao
#    tiếp qua mạng nội bộ Compose, giảm bề mặt tấn công.
# 3) Frontend Nginx tự reverse-proxy /api sang backend (xem frontend/nginx.conf)
#    nên KHÔNG cần VITE_DEV_PROXY_TARGET (đó là biến chỉ dùng cho Vite dev server).
# 4) Caddy đứng trước Nginx làm TLS termination (Let's Encrypt tự động, xem
#    devops/Caddyfile) + redirect HTTP->HTTPS + HSTS — nếu chạy Compose này mà
#    truy cập qua HTTP thuần, cookie refreshToken Secure (bật khi
#    NODE_ENV=production, xem backend/src/main.ts) sẽ KHÔNG được trình duyệt
#    gửi lên và đăng nhập không hoạt động.
#
# Chạy: docker compose -f devops/docker-compose.prod.yml --env-file devops/.env.prod up -d --build
# Yêu cầu:
# - backend/.env đã điền đủ secret thật (JWT_*, GEMINI_API_KEY nếu cần...) và
#   NODE_ENV=production, TRUST_PROXY_HOPS=2 (Caddy + Nginx đứng trước backend).
# - devops/.env.prod đã điền DOMAIN (trỏ DNS về máy này, cổng 80/443 mở ra
#   Internet) và POSTGRES_PASSWORD thật — xem devops/.env.prod.example.
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: edupath
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD chưa được đặt — xem devops/.env.prod.example}
      POSTGRES_DB: edupath
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U edupath"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: ../backend
      target: production
    restart: unless-stopped
    env_file:
      - ../backend/.env
    environment:
      DATABASE_URL: postgresql://edupath:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD chưa được đặt}@postgres:5432/edupath?schema=public
      REDIS_HOST: redis
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))",
        ]
      interval: 5s
      timeout: 5s
      retries: 30
      start_period: 20s

  frontend:
    build:
      context: ../frontend
      target: production
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN:?DOMAIN chưa được đặt — xem devops/.env.prod.example}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

- [ ] **Step 4: Update `backend/.env.example`'s `TRUST_PROXY_HOPS` comment to mention this**

Already covers this in Task 3 Step 3 (the comment says "2 nếu có thêm Caddy/LB"). No further change needed here — just set `TRUST_PROXY_HOPS=2` in the real `backend/.env` used with this Compose profile (document this in Step 5).

- [ ] **Step 5: Document the deploy prerequisites**

In `devops/docker-compose.prod.yml`'s header comment (already written in Step 3 above), the run command and requirements are documented inline. No separate doc file needed per current repo conventions (no `devops/README.md` exists — check with `ls devops/` before adding one; if the team wants a full deployment doc, that's a follow-up, not blocking this fix).

- [ ] **Step 6: Validate Compose file syntax**

Run: `docker compose -f devops/docker-compose.prod.yml --env-file devops/.env.prod.example config` (from repo root)
Expected: prints the fully resolved Compose config with no errors (this only validates YAML/interpolation, it does not start containers).

- [ ] **Step 7: Commit**

```bash
git add devops/Caddyfile devops/.env.prod.example devops/docker-compose.prod.yml
git commit -m "fix(deploy): add Caddy TLS termination, drop hardcoded Postgres password"
```

---

## Self-Review Notes

- **Spec coverage:** all 5 P0 items have at least one task. The one sub-item NOT covered by a code change is "Không để CI merge khi e2e thất bại" — `.github/workflows/ci.yml` already runs `npm run test:e2e` as a required (non-`continue-on-error`) step; making it block merges is a GitHub branch-protection *repo setting* (Settings → Branches → require status check `backend`), not a file in this repo, so it isn't a task here — call it out to the user as a manual follow-up.
- **Placeholder scan:** none found — every step has literal code/config or a literal shell command.
- **Type consistency:** `GradeEssayJobData` (Task 8) matches the shape already used by `GradeEssayProcessor`/`processQueuedEssayGrading` (unchanged). `essayJobId(attemptId, questionId)` is used identically in `submitAttempt`, `enqueueEssayGradingJob`, and the Task 8 Step 5 test assertion. `OutboxStatus.PENDING`/`PROCESSED` match the Task 7 Prisma enum.

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-07-30-p0-critical-fixes.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
