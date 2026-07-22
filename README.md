# EduPath

Hệ thống web luyện thi thử dành cho học sinh lớp 12 chuẩn bị kỳ thi tốt nghiệp THPT. Học sinh làm đề, luyện theo chuyên đề, xem kết quả và nhận lộ trình ôn tập cá nhân hóa. Giáo viên/trung tâm tạo lớp, quản lý học sinh, biên soạn đề riêng. Quản trị viên quản lý ngân hàng câu hỏi dùng chung và toàn hệ thống.

Mô tả nghiệp vụ đầy đủ: [docs/PROJECT.md](docs/PROJECT.md).

> **Trạng thái:** dự án đang phát triển (MVP). Phần "Giới hạn hiện tại" ở cuối file liệt kê rõ những gì chưa hoàn thiện hoặc còn là placeholder — đọc trước khi coi bất kỳ tính năng nào là sản phẩm hoàn chỉnh.

## Kiến trúc

```
frontend/   React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query
backend/    NestJS + TypeScript + Prisma ORM + PostgreSQL + Passport JWT
devops/     Docker Compose cho môi trường dev (postgres + backend + frontend)
docs/       Đặc tả nghiệp vụ
```

Không có AI service riêng biệt (Python/FastAPI) — toàn bộ logic "AI cá nhân hoá" hiện chạy ngay trong NestJS backend dưới dạng rule-based (xem mục AI bên dưới), chưa gọi LLM thật.

Backend không có global prefix `/api` — route nằm ở gốc (`/auth/login`, `/classes`, ...). Frontend dev server tự thêm prefix `/api` và Vite proxy rewrite bỏ nó đi trước khi chuyển tiếp tới backend (xem `frontend/vite.config.ts`).

## Vai trò và mô hình B2B2C

| Vai trò | Quyền hạn chính |
|---|---|
| Học sinh (STUDENT) | Làm đề, luyện chuyên đề, xem lời giải sau khi nộp bài, xem điểm yếu và lộ trình AI của chính mình |
| Giáo viên (TEACHER) | Tạo lớp (riêng tư hoặc công khai), mời học sinh, tạo câu hỏi/đề riêng trong tenant của mình, duyệt điểm Văn do AI chấm |
| Quản trị viên (ADMIN) | Quản lý người dùng, tenant, môn học/chuyên đề, ngân hàng câu hỏi dùng chung, duyệt câu hỏi giáo viên đề xuất, xem thống kê và audit log |

Mô hình tự phục vụ: giáo viên/trung tâm đăng ký (`role=TEACHER` + `tenantName`) sẽ tự động được tạo một **Tenant** riêng — toàn bộ lớp, câu hỏi, đề thi họ tạo đều gắn với tenant đó và tách biệt với tenant khác (kiểm tra RBAC + tenant scoping ở backend, không chỉ ở giao diện). Học sinh có thể tự đăng ký độc lập, không bắt buộc thuộc lớp nào, và có thể thuộc nhiều lớp/tenant cùng lúc.

### Lớp công khai và lớp riêng tư

- Mặc định lớp là **riêng tư**: học sinh chỉ tham gia được bằng mã mời (`inviteCode`), qua `POST /classes/join`.
- Giáo viên có thể bật `isPublic: true` khi tạo hoặc sửa lớp. Lớp công khai xuất hiện trong `GET /classes/public` để bất kỳ học sinh nào cũng có thể duyệt và tham gia bằng một lượt gọi `POST /classes/:id/join-public`, không cần biết mã mời.
- Tắt `isPublic` hoặc xoá lớp sẽ khiến lớp biến mất khỏi danh sách công khai ngay lập tức.
- Giáo viên tenant khác không thể sửa, tắt công khai, hay xoá lớp không thuộc tenant của mình (đã có test bảo mật riêng, xem mục Test).

## Xác thực và refresh token

- Đăng ký/đăng nhập trả về cặp `accessToken` (15 phút) và `refreshToken` (7 ngày), ký JWT riêng biệt bằng hai secret khác nhau.
- Refresh token được lưu **hash SHA-256** (không lưu plaintext) trong bảng `RefreshToken`, kèm thời điểm hết hạn.
- `POST /auth/refresh`: xoay vòng (rotate) — token cũ bị thu hồi ngay khi dùng bằng một câu `UPDATE` nguyên tử có điều kiện (không phải đọc-rồi-ghi), nên hai request refresh đồng thời dùng chung một token không thể cả hai đều thành công. Mỗi refresh token có thêm `jti` ngẫu nhiên để đảm bảo duy nhất kể cả khi cấp trong cùng một giây.
- `POST /auth/logout`: thu hồi refresh token được cung cấp (best-effort, không lỗi nếu token không còn tồn tại).
- Frontend: `api-client.ts` tự động bắt lỗi 401, gọi `/auth/refresh` một lần (gộp các request 401 đồng thời thành một lần refresh duy nhất), rồi thử lại request gốc. Nếu refresh thất bại, xoá toàn bộ token cục bộ và chuyển hướng về `/login`.

## Luồng chấm điểm và AI cá nhân hoá — **rule-based, chưa phải AI thật**

Đây là phần quan trọng cần hiểu đúng trước khi trình bày dự án:

- **Trắc nghiệm nhiều lựa chọn, đúng/sai, trả lời ngắn**: chấm tự động bằng logic so sánh trực tiếp (không dùng AI). Đúng/sai áp dụng đúng thang điểm lũy tiến của đề thi THPT 2025 (1 ý đúng = 0.1, 2 ý = 0.25, 3 ý = 0.5, 4 ý = 1.0 × điểm câu).
- **Tự luận (Ngữ văn)**: điểm "AI chấm sơ bộ" hiện là **một hàm heuristic dựa trên số từ** trong bài làm (`backend/src/grading/grading.utils.ts::gradeEssayPlaceholder`) — **không gọi LLM/API AI thật nào**. Đây là placeholder được đánh dấu rõ trong code, dự định thay bằng lời gọi mô hình ngôn ngữ thật sau này.
  - Nếu đề không gắn lớp học nào (học sinh tự học): điểm AI được công bố ngay, `isAiReferenceOnly=true`, và cần hiển thị rõ nhãn **"Điểm AI tham khảo, chưa được giáo viên duyệt."**
  - Nếu đề gắn với một lớp học: điểm giữ ở trạng thái chờ (`scoreAwarded=null`), giáo viên phải vào `POST /grading/answers/:answerId/review` để nhập điểm chính thức trước khi công bố.
- **Phân tích điểm yếu và lộ trình ôn tập**: cũng là **rule-based**, không gọi AI thật. Sau khi một lượt làm bài được chấm xong hoàn toàn, hệ thống tính tỷ lệ đúng theo từng chuyên đề; chuyên đề có tỷ lệ đúng dưới 50% bị coi là điểm yếu, và một lộ trình cố định 4 giai đoạn (ôn lý thuyết → làm cơ bản → luyện vận dụng → kiểm tra lại) được tạo cho mỗi chuyên đề yếu (`backend/src/roadmap/roadmap.service.ts`).

## Chạy local (không dùng Docker)

Yêu cầu: Node.js 22, Docker (chỉ để chạy Postgres) hoặc Postgres cài sẵn.

```bash
# 1. Khởi động Postgres (dùng Docker Compose chỉ cho service này)
cd devops
docker compose up -d postgres

# 2. Backend
cd ../backend
cp .env.example .env        # sửa secret nếu cần
npm install                 # postinstall tự chạy `prisma generate`
npx prisma migrate dev      # tạo schema (lần đầu) — xem mục Migration bên dưới
npm run start:dev           # http://localhost:3000, Swagger: http://localhost:3000/api-docs

# 3. Frontend (terminal khác)
cd ../frontend
npm install
npm run dev                 # http://localhost:5173, proxy /api -> http://localhost:3000
```

## Chạy bằng Docker Compose (toàn bộ hệ thống)

```bash
cd devops
docker compose up --build
```

Một lệnh duy nhất khởi động cả 3 service: `postgres` (có healthcheck), `backend` (chỉ start sau khi postgres healthy, có healthcheck riêng), `frontend` (chỉ start sau khi backend healthy). Frontend chạy ở chế độ dev server bên trong container, proxy `/api` trỏ vào `http://backend:3000` (tên service trong mạng Compose, **không phải** `localhost`).

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Swagger: http://localhost:3000/api-docs
- Postgres: localhost:5432 (user/pass/db: `edupath`/`edupath`/`edupath`)

Đã verify thực tế: build cả hai image thành công, cả 3 container lên `healthy`/`running`, đăng ký tài khoản qua cổng frontend (5173, đi qua proxy tới container backend) và chạy trọn một luồng đề thi (tạo đề → gán câu hỏi → học sinh làm bài → nộp → chấm điểm `GRADED`) qua container backend (3000) — không cần chạy gì trên máy host ngoài Docker.

`.env` không được build vào image (`.dockerignore` loại trừ ở cả hai project) — biến môi trường được truyền qua `env_file`/`environment` trong `docker-compose.yml` tại thời điểm chạy container.

## Migration (Prisma)

```bash
cd backend
npx prisma migrate dev --name <tên_migration>   # tạo + áp dụng migration mới khi sửa schema.prisma
npx prisma migrate deploy                       # áp dụng migration có sẵn (CI, production) - không tạo migration mới
npx prisma migrate status                       # kiểm tra drift
```

Đã verify: chạy `prisma migrate deploy` trên một database hoàn toàn sạch (tạo riêng, không phải database dev) áp dụng đúng cả 2 migration hiện có, tạo đúng cột `Class.isPublic` và bảng `RefreshToken`, `migrate status` báo "up to date", không phụ thuộc dữ liệu test nào từ trước. Database dev đang dùng không còn dữ liệu test sót lại (đã kiểm tra count = 0 mọi bảng chính).

## Test

```bash
# Backend (cần Postgres đang chạy — devops: docker compose up -d postgres)
cd backend
npx eslint "{src,apps,libs,test}/**/*.ts"   # lint (CI chạy không kèm --fix)
npx tsc --noEmit -p tsconfig.json           # typecheck
npm run build                               # build
npm run test                                # unit test
npm run test:e2e                            # e2e test (4 file, 20 test case) — cần Postgres

# Frontend
cd frontend
npm run lint
npx tsc -b
npm run test                                # vitest, 14 test case
npm run build
```

Bộ e2e test backend (`backend/test/*.e2e-spec.ts`) chạy trực tiếp trên Postgres thật (không mock DB), bao gồm:
- `flows.e2e-spec.ts`: đăng ký/đăng nhập theo vai trò, tạo lớp, tham gia bằng mã mời, vòng đời làm bài đầy đủ, ẩn `correctAnswer` khi đang làm bài, chặn học sinh ngoài lớp, chặn giáo viên khác tenant, duyệt điểm Văn, nhãn điểm AI tham khảo, roadmap sau khi chấm, chặn route theo vai trò.
- `public-classes.e2e-spec.ts`: lọc đúng lớp công khai, chặn tham gia trùng lặp, chặn truy cập không xác thực, chặn giáo viên tenant khác sửa/tắt/xoá lớp, lớp biến mất khỏi danh sách khi tắt công khai/xoá.
- `refresh-token.e2e-spec.ts`: refresh hợp lệ, chặn token đã xoay vòng, `jti` duy nhất dù cùng giây, chặn token hết hạn, chặn token không có bản ghi tương ứng, logout thu hồi đúng token, refresh đồng thời không nhân bản token (test này từng phát hiện một race condition thật, đã sửa bằng UPDATE nguyên tử có điều kiện).

Frontend test (`vitest` + Testing Library): route guard theo vai trò, luồng tạo lớp của giáo viên, luồng duyệt/từ chối câu hỏi của admin, và interceptor 401 (gộp refresh đồng thời thành một lần gọi, không lặp vô hạn khi refresh xong vẫn còn 401, đăng xuất ngay khi không có refresh token).

CI (`.github/workflows/ci.yml`) chạy toàn bộ danh sách trên cho cả backend và frontend trên mỗi push/PR vào `main`.

## Swagger / OpenAPI

http://localhost:3000/api-docs (chạy backend rồi mở, hoặc `/api-docs-json` để lấy spec JSON thô).

Đã audit toàn bộ 10 module (auth, users, classes, subjects, questions, exams, grading, roadmap, admin) — mỗi endpoint có `@ApiOperation` (mô tả kèm vai trò/tenant scoping bắt buộc), `@ApiResponse` cho mã thành công và các mã lỗi thực sự có thể xảy ra, `@ApiParam`/`@ApiQuery` cho tham số, và `@ApiBearerAuth` trên mọi controller trừ các endpoint công khai của auth. Đã kiểm tra bằng script đối chiếu spec JSON thực tế (không chỉ đọc code): toàn bộ 47 operation (trên 39 đường dẫn) đều có `summary` + `responses`, mọi operation cần xác thực đều yêu cầu bearer token và không endpoint công khai nào bị yêu cầu nhầm.

## Giới hạn hiện tại

- **Chấm tự luận và roadmap AI là rule-based/placeholder**, chưa gọi LLM thật (xem mục AI ở trên) — đừng trình bày đây là "AI thật" trước nhà tuyển dụng/giám khảo mà không giải thích rõ.
- Không có khu vực dành cho phụ huynh; chưa rà soát pháp lý đầy đủ theo Nghị định 13/2023/NĐ-CP dù kiến trúc đã tách bạch dữ liệu theo vai trò.
- Frontend chưa có bản build "production" thực sự phục vụ qua Nginx với reverse proxy `/api` — Dockerfile có stage `production` cho backend (đã sửa lỗi build) nhưng stage `production` của frontend (Nginx serve static) chưa có cấu hình proxy API, nên hiện chỉ dùng được stage `dev` (đã là stage mà `docker-compose.yml` sử dụng).
- Danh sách/audit log, người dùng, tenant chưa có UI phân trang phía frontend dù backend `admin/audit-logs` đã hỗ trợ `skip`/`take`.
- Refresh token hiện không hỗ trợ "đăng xuất tất cả thiết bị" (chỉ thu hồi đúng token được cung cấp khi logout).
