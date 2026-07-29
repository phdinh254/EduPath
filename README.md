# EduPath

![CI](https://github.com/phdinh254/EduPath/actions/workflows/ci.yml/badge.svg)

**Nền tảng luyện thi THPT quốc gia & Đánh giá năng lực (ĐGNL) dùng AI** — học sinh tự chọn đề, làm bài, và nhận điểm cùng nhận xét ngay lập tức, không cần chờ ai chấm hay tham gia lớp học nào.

Mô tả nghiệp vụ và kỹ thuật đầy đủ: [docs/PROJECT.md](docs/PROJECT.md).

## Giới thiệu

EduPath giải quyết một vấn đề cụ thể: học sinh lớp 12 ôn thi thường phải chờ đợi — chờ giáo viên chấm bài tự luận, chờ có đủ người mở lớp, chờ biết mình đang yếu ở đâu. EduPath bỏ qua toàn bộ những khâu chờ đợi đó bằng cách để AI (Google Gemini) đảm nhiệm việc chấm điểm, sinh đề, giải thích lỗi sai và tư vấn lộ trình ôn tập — tất cả diễn ra trong vài giây ngay sau khi học sinh nộp bài.

Đây là mô hình **B2C tự phục vụ**: không có giáo viên, lớp học hay trung tâm trong hệ thống. Học sinh tự đăng ký (email hoặc Google), tự chọn đề THPT hoặc ĐGNL để luyện, và tự quản lý lộ trình ôn tập của mình.

## Tính năng chính

### Dành cho học sinh

- Đăng ký / đăng nhập bằng email hoặc **tài khoản Google thật** (OAuth2).
- Duyệt và làm bất kỳ đề thi nào đã có trong hệ thống — không cần mã lớp, không cần chờ giáo viên giao đề.
- **Chấm điểm tức thời** ngay sau khi nộp bài, kể cả bài tự luận Ngữ văn — AI đọc đúng nội dung bài làm để chấm, không phải đếm số từ.
- Với câu trắc nghiệm/đúng-sai/trả lời ngắn bị sai: bấm một nút để AI giải thích chính xác vì sao sai và đáp án đúng là gì.
- Nhận phân tích điểm yếu theo từng chuyên đề sau mỗi lần làm bài, kèm lộ trình ôn tập 4 giai đoạn và **lời khuyên cụ thể do AI viết riêng** cho từng chuyên đề yếu.

### Dành cho quản trị viên

- Tạo câu hỏi/đề thi thủ công, hoặc để **AI tự soạn nội dung mới** (không sao chép đề thi thật) và tự động ghép thành đề hoàn chỉnh chỉ với vài tham số.
- Duyệt hoặc từ chối (kèm lý do) nội dung do AI đề xuất trước khi vào kho câu hỏi dùng chung.
- Hậu kiểm — điều chỉnh lại điểm AI đã chấm cho bài tự luận nếu cần, không chặn việc học sinh đã xem điểm trước đó.
- Quản lý người dùng, môn học/chuyên đề, xem thống kê hệ thống và nhật ký hoạt động (audit log).

### Hai kỳ thi, một nền tảng

| Kỳ thi | Cấu trúc |
|---|---|
| **THPT quốc gia** | 1 môn/đề. Trắc nghiệm 3 dạng (nhiều lựa chọn, đúng/sai lũy tiến, trả lời ngắn) hoặc tự luận Ngữ văn (Đọc hiểu + Viết). |
| **Đánh giá năng lực (ĐGNL)** | Nhiều phần thi (section) theo môn khác nhau trong cùng một đề, tổng thang điểm 150. |

### AI thật, có lối thoát an toàn

Bốn tính năng dùng **Google Gemini API thật**: chấm tự luận Văn, sinh câu hỏi mới, giải thích câu sai, viết lời khuyên ôn tập. Mỗi tính năng đều tự động rơi về logic rule-based có sẵn nếu chưa cấu hình `GEMINI_API_KEY` hoặc Gemini gặp sự cố (quota, mạng, phản hồi sai định dạng) — một API bên ngoài gặp sự cố không làm gián đoạn việc nộp bài hay ghép đề của học sinh.

## Kiến trúc & công nghệ

```
frontend/   React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query
backend/    NestJS + TypeScript + Prisma ORM + PostgreSQL + Passport (JWT + Google OAuth2)
devops/     Docker Compose cho môi trường dev (postgres + backend + frontend)
docs/       Đặc tả nghiệp vụ và kỹ thuật chi tiết
```

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, TanStack Query, Axios |
| Backend | NestJS 11, TypeScript, Prisma ORM (`@prisma/adapter-pg`), PostgreSQL, Passport (JWT + Google OAuth2), Argon2, class-validator/class-transformer, Swagger/OpenAPI |
| AI | Google Gemini API (`@google/generative-ai`) |
| Test | Jest + Supertest (backend, e2e chạy trên PostgreSQL thật), Vitest + Testing Library (frontend) |
| DevOps | Docker, Docker Compose, GitHub Actions CI |

Vai trò hệ thống chỉ còn hai: **STUDENT** (tự phục vụ, chỉ thấy dữ liệu của chính mình) và **ADMIN** (toàn quyền quản lý nội dung và hệ thống) — không có giáo viên/lớp học/trung tâm.

## Bắt đầu nhanh

Yêu cầu: Node.js 22+, Docker (chạy PostgreSQL).

```bash
# 1. PostgreSQL
cd devops && docker compose up -d postgres

# 2. Backend
cd ../backend
cp .env.example .env      # điền secret; GOOGLE_*/GEMINI_API_KEY nếu muốn đăng nhập Google/AI thật
npm install                # postinstall tự chạy `prisma generate`
npx prisma migrate deploy
npm run start:dev          # http://localhost:3000 — Swagger: http://localhost:3000/api-docs

# 3. Frontend (terminal khác)
cd ../frontend
npm install
npm run dev                 # http://localhost:5173
```

Hoặc chạy toàn bộ bằng một lệnh:

```bash
cd devops && docker compose up --build
```

Production (build tối ưu, frontend serve qua Nginx với reverse proxy `/api` — xem `frontend/nginx.conf`):

```bash
cd devops && docker compose -f docker-compose.prod.yml up -d --build
```

### Biến môi trường chính (`backend/.env`)

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi kết nối PostgreSQL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ✅ | Secret ký JWT |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Tuỳ chọn | Đăng nhập bằng Google — lấy tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Thiếu thì `/auth/google` trả lỗi 503 rõ ràng thay vì crash server |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Tuỳ chọn | AI thật cho chấm Văn/sinh câu hỏi/giải thích/lời khuyên — lấy tại [Google AI Studio](https://aistudio.google.com/apikey). Thiếu thì hệ thống tự dùng logic rule-based có sẵn |
| `FRONTEND_URL` | Khi dùng Google login | URL frontend để redirect về sau khi đăng nhập Google |

Xem đầy đủ tại `backend/.env.example`.

## Vận hành: backup & rollback

```bash
cd devops
./backup-postgres.sh                 # backup định kỳ, mặc định giữ 14 ngày gần nhất
./restore-postgres.sh backups/edupath_20260729_020000.dump
```

Đặt `backup-postgres.sh` vào cron để chạy tự động (xem comment đầu file).
Rollback migration Prisma (không có down migration tự sinh) theo từng bước
tại [devops/MIGRATION_ROLLBACK.md](devops/MIGRATION_ROLLBACK.md).

## Kiểm thử

```bash
# Backend
cd backend
npx eslint "{src,apps,libs,test}/**/*.ts"
npx tsc --noEmit -p tsconfig.json
npm run test          # unit test
npm run test:e2e      # e2e test — cần PostgreSQL đang chạy

# Frontend
cd frontend
npm run lint
npx tsc -b
npm run test
```

CI (`.github/workflows/ci.yml`) chạy toàn bộ danh sách trên cho cả hai project trên mỗi push/PR vào `main`.

## API docs

Swagger UI: `http://localhost:3000/api-docs` sau khi chạy backend.

## Giới hạn hiện tại

- Chưa có tính năng đặt lại mật khẩu thật (link "Quên mật khẩu?" hiện chỉ hiển thị thông báo tính năng đang phát triển).
- Cấu trúc đề ĐGNL (3 phần thi, thang điểm 150) là cấu hình mặc định tham khảo — admin tự khai báo section/thang điểm khi ghép đề, chưa cố định theo đề thi thật của một đại học cụ thể.
- Chưa rà soát pháp lý đầy đủ theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân trẻ em.

## Giấy phép

Dự án cá nhân/học tập, hiện chưa gắn giấy phép mã nguồn mở chính thức.
