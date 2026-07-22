# EduPath — Đặc tả nghiệp vụ & kỹ thuật

Tài liệu này mô tả chi tiết nghiệp vụ và kiến trúc kỹ thuật hiện tại của EduPath. Giới thiệu tổng quan xem tại [README.md](../README.md).

## Bài toán và mục tiêu

Học sinh lớp 12 ôn thi THPT quốc gia và luyện thi Đánh giá năng lực (ĐGNL) thường phải chờ đợi: chờ giáo viên chấm bài tự luận, chờ đủ người mở lớp, chờ biết mình đang yếu ở đâu để ôn đúng trọng tâm. EduPath loại bỏ các khâu chờ đợi này bằng cách để AI (Google Gemini) đảm nhiệm chấm điểm, sinh đề, giải thích lỗi sai và tư vấn lộ trình — toàn bộ diễn ra trong vài giây ngay sau khi học sinh nộp bài.

## Mô hình vận hành: B2C tự phục vụ

EduPath là nền tảng **B2C thuần túy** — không có khái niệm giáo viên, lớp học hay trung tâm (tenant) trong hệ thống. Học sinh tự đăng ký (email/mật khẩu hoặc Google OAuth) và có thể làm bất kỳ đề thi nào đã được ADMIN công bố, không cần gia nhập lớp hay được ai giao đề trước.

Toàn bộ nội dung (câu hỏi, đề thi) do ADMIN quản lý tập trung: tạo thủ công hoặc để AI tự soạn, sau đó ADMIN duyệt trước khi đưa vào kho dùng chung.

## Đối tượng sử dụng

| Vai trò | Mục đích sử dụng |
|---|---|
| **STUDENT** | Tự đăng ký, chọn đề THPT hoặc ĐGNL để làm, xem điểm/lời giải/giải thích câu sai ngay lập tức, nhận phân tích điểm yếu và lộ trình ôn tập cá nhân hoá |
| **ADMIN** | Quản lý toàn bộ tài khoản, môn học/chuyên đề, đề thi, ngân hàng câu hỏi (tạo thủ công hoặc duyệt nội dung AI sinh), điều chỉnh điểm AI chấm nếu cần, xem thống kê và nhật ký hoạt động hệ thống |

Không còn vai trò TEACHER; các model `Tenant`, `Class`, `StudentClass` đã bị loại bỏ hoàn toàn khỏi schema.

## Hai kỳ thi trên cùng một nền tảng

Hệ thống được thiết kế để hai luồng nghiệp vụ phát triển song song, dùng chung phần lớn hạ tầng (chấm điểm, roadmap, AI):

| Kỳ thi | `ExamCategory` | Cấu trúc |
|---|---|---|
| **THPT quốc gia** | `THPT` | Một môn/đề (`Exam.subjectId` bắt buộc). Trắc nghiệm gồm 3 dạng câu (nhiều lựa chọn, đúng/sai lũy tiến theo số ý đúng, trả lời ngắn), hoặc tự luận Ngữ văn (Đọc hiểu + Viết). |
| **Đánh giá năng lực (ĐGNL)** | `DGNL` | Nhiều phần thi (`ExamSection`) thuộc các môn khác nhau trong cùng một đề (`Exam.subjectId` để trống); mỗi câu hỏi gắn với một `ExamSection` qua `ExamQuestion.sectionId`. Cấu trúc phần thi/thang điểm do ADMIN tự khai báo khi ghép đề, không cố định theo đề thi thật của một đại học cụ thể. |

## Ngân hàng câu hỏi và AI sinh nội dung

Không còn luồng giáo viên tự soạn câu hỏi/đề thi. Nội dung vào kho dùng chung theo hai cách:

1. **ADMIN tạo thủ công** — vào thẳng trạng thái `APPROVED`.
2. **AI tự sinh** (`POST /questions/generate`) — Gemini soạn nội dung hoàn toàn mới theo chuyên đề, mức độ và dạng câu được chỉ định, tuyệt đối không sao chép nguyên văn đề thi chính thức của Bộ GD&ĐT hay tài liệu bản quyền của bên thứ ba. Kết quả vào trạng thái `PENDING_APPROVAL`, chờ ADMIN duyệt hoặc từ chối (kèm lý do, ghi vào `AuditLog`) trước khi vào kho dùng chung.

Khi ghép đề tự động (ĐGNL hoặc sinh hàng loạt câu hỏi cho một chuyên đề), nếu kho chưa đủ câu hỏi đã duyệt, hệ thống có thể tự động sinh bù bằng AI. Nếu `GEMINI_API_KEY` chưa cấu hình hoặc Gemini gặp sự cố, hệ thống rơi về bộ sinh câu hỏi rule-based/templated có sẵn (xem `backend/src/questions/ai-question.generator.ts`) — không chặn luồng ghép đề.

## Chấm điểm

Chấm điểm là **tức thời** cho mọi dạng câu hỏi, ngay sau khi học sinh nộp bài — không có bước chờ duyệt trước khi công bố điểm:

- **Trắc nghiệm nhiều lựa chọn**: 0,25 điểm/câu, so khớp `correctAnswer.index`.
- **Đúng/sai**: thang điểm lũy tiến theo số ý đúng trong 4 ý nhỏ (a–d).
- **Trả lời ngắn**: so khớp giá trị đã chuẩn hoá.
- **Tự luận Ngữ văn**: chấm bằng Gemini thật (đọc và đánh giá đúng nội dung bài làm, không đếm từ), trả điểm và nhận xét ngay. Nếu Gemini chưa cấu hình hoặc lỗi, hệ thống rơi về chấm rule-based đơn giản (`gradeEssayPlaceholder`) để không chặn việc nộp bài.

Sau khi có điểm, ADMIN vẫn có thể hậu kiểm và điều chỉnh điểm tự luận qua `ScoreOverride` (đổi tên từ `TeacherReview` cũ) nếu phát hiện AI chấm sai — việc này không thu hồi điểm học sinh đã xem trước đó, chỉ cập nhật điểm chính thức.

## Giải thích câu sai (AI, theo yêu cầu)

Với câu trắc nghiệm/đúng-sai/trả lời ngắn bị sai (không áp dụng cho tự luận), học sinh có thể chủ động yêu cầu AI giải thích (`POST /grading/answers/:answerId/explain`). Kết quả được tính toán **lười** (chỉ khi được yêu cầu lần đầu) và lưu cache vào `Answer.aiExplanation` để các lần xem sau không gọi lại Gemini. Chỉ chủ sở hữu câu trả lời hoặc ADMIN mới được xem.

## Phân tích điểm yếu và lộ trình ôn tập

Sau mỗi lần nộp bài, hệ thống phân tích tỷ lệ đúng theo từng chuyên đề (`topicBreakdown`), xác định chuyên đề có tỷ lệ đúng dưới ngưỡng (< 50%) là điểm yếu — logic ngưỡng này vẫn thuần rule-based, không đổi.

Vì đề ĐGNL có thể trải nhiều môn trong cùng một lượt làm bài, mỗi mục trong `topicBreakdown` mang theo `subjectId` riêng; việc nhóm điểm yếu theo môn dựa trên trường này thay vì `exam.subjectId` chung.

Với mỗi chuyên đề yếu, hệ thống gọi Gemini (bất đồng bộ, không chặn việc trả kết quả bài thi) để viết lời khuyên ôn tập cụ thể, lưu vào `WeaknessAnalysis.details.adviceByTopic`. Nếu Gemini chưa cấu hình, lời khuyên AI đơn giản là không xuất hiện — phần phân tích điểm yếu rule-based vẫn hoạt động bình thường.

## AI thật, có lối thoát an toàn (graceful fallback)

Bốn tính năng dùng **Google Gemini API thật** qua `GeminiService` dùng chung (`backend/src/ai/gemini.service.ts`): chấm tự luận Văn, sinh câu hỏi mới, giải thích câu sai, viết lời khuyên ôn tập.

Nguyên tắc thiết kế xuyên suốt: **một API bên ngoài gặp sự cố không bao giờ được làm gián đoạn nghiệp vụ cốt lõi** (nộp bài, ghép đề). Mỗi tính năng đều kiểm tra `GeminiService.isConfigured()` và bọc lời gọi thật trong try/catch, tự động rơi về logic rule-based/templated có sẵn nếu:
- `GEMINI_API_KEY` chưa được cấu hình, hoặc
- lời gọi Gemini thất bại (hết quota, lỗi mạng, phản hồi sai định dạng JSON).

Tương tự, đăng nhập Google OAuth dùng `GoogleConfiguredGuard`: nếu `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` chưa cấu hình, endpoint `/auth/google` trả lỗi 503 rõ ràng thay vì làm crash toàn bộ server khi khởi động.

## Phân quyền (RBAC)

| Vai trò | Quyền hạn |
|---|---|
| STUDENT | Đăng ký/đăng nhập, làm bất kỳ đề thi nào, xem lời giải/lịch sử của chính mình, yêu cầu AI giải thích câu sai, xem phân tích điểm yếu và lộ trình ôn tập của chính mình |
| ADMIN | Toàn quyền quản lý tài khoản, môn học/chuyên đề, đề thi, ngân hàng câu hỏi (tạo/duyệt/từ chối), hậu kiểm điểm tự luận, xem thống kê hệ thống và audit log |

Toàn bộ kiểm tra quyền được thực hiện ở backend bằng JWT (access 15 phút / refresh 7 ngày, xoay vòng refresh token khi dùng) và guard RBAC (`@Roles(...)`), không chỉ dựa vào việc ẩn/hiện ở giao diện.

## Đăng ký tài khoản

`POST /auth/register` luôn tạo tài khoản với `Role.STUDENT`, bất kể client gửi gì trong request — tài khoản ADMIN chỉ được tạo trực tiếp trong cơ sở dữ liệu. Đây là biện pháp chặn việc tự leo quyền qua API đăng ký công khai.

## Tuân thủ và bảo mật dữ liệu

Phần lớn học sinh sử dụng hệ thống là học sinh lớp 12, dưới 18 tuổi. Việc thu thập, lưu trữ và xử lý dữ liệu của nhóm người dùng này cần tuân thủ quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, đặc biệt là các yêu cầu riêng đối với dữ liệu trẻ em theo Nghị định 13/2023/NĐ-CP. Hệ thống đã có cơ chế ẩn danh hoá dữ liệu học sinh ở một số điểm, nhưng **chưa được rà soát pháp lý đầy đủ** — cần chuyên gia pháp lý xem xét trước khi ra mắt chính thức hoặc bổ sung tính năng thu thập thêm dữ liệu.

## Kiến trúc kỹ thuật

```
frontend/   React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router v7 + TanStack Query + Axios
backend/    NestJS 11 + TypeScript + Prisma ORM + PostgreSQL + Passport (JWT + Google OAuth2)
devops/     Docker Compose cho môi trường dev (postgres + backend + frontend)
docs/       Tài liệu này
```

### Backend — cấu trúc module (`backend/src/`)

`admin, ai, auth, exams, grading, prisma, questions, roadmap, subjects, users` — không còn module `classes`.

- `ai/` — `GeminiService` dùng chung, wrap `@google/generative-ai`, expose `isConfigured()`, `generateText()`, `generateJson<T>()`.
- `auth/` — JWT (access/refresh), Google OAuth2 (`GoogleStrategy` + `GoogleConfiguredGuard`), refresh token lưu dạng SHA-256 hash, xoay vòng qua `updateMany` có điều kiện để tránh race condition nhân bản token.
- `exams/` — tạo/ghép đề THPT và ĐGNL, quản lý `ExamSection`, làm bài, nộp bài.
- `grading/` — chấm điểm tức thời (3 dạng trắc nghiệm + tự luận qua Gemini), giải thích câu sai, hậu kiểm (`ScoreOverride`).
- `questions/` — CRUD câu hỏi thủ công + AI sinh (`ai-question.generator.ts`), duyệt/từ chối.
- `roadmap/` — phân tích điểm yếu theo chuyên đề (đa môn), lời khuyên AI bất đồng bộ.
- `subjects/`, `users/`, `admin/` — quản lý môn học/chuyên đề, người dùng, thống kê hệ thống.

### Cơ sở dữ liệu chính (PostgreSQL, qua Prisma)

`User` (Role: `STUDENT` | `ADMIN`), `Subject`, `Topic`, `Question`, `Exam`, `ExamSection`, `ExamQuestion`, `ExamAttempt`, `Answer`, `Score`, `WeaknessAnalysis`, `StudyRoadmap`, `ScoreOverride`, `AuditLog`, `RefreshToken`.

Không còn `Tenant`, `Class`, `StudentClass` trong schema.

### Công nghệ

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, TanStack Query, Axios |
| Backend | NestJS 11, TypeScript, Prisma ORM (`@prisma/adapter-pg`), PostgreSQL, Passport (JWT + Google OAuth2), Argon2, class-validator/class-transformer, Swagger/OpenAPI |
| AI | Google Gemini API (`@google/generative-ai`) |
| Test | Jest + Supertest (backend, e2e chạy trên PostgreSQL thật, không mock DB), Vitest + Testing Library (frontend) |
| DevOps | Docker, Docker Compose, GitHub Actions CI |

### DevOps

Docker Compose khởi động theo thứ tự có health-check: `postgres` → `backend` (nhận toàn bộ `.env` qua `env_file`, nên biến `GOOGLE_*`/`GEMINI_*` mới không cần sửa `docker-compose.yml`) → `frontend`. Chưa có cấu hình Nginx reverse proxy cho môi trường production.

## Giới hạn hiện tại

- Chưa có tính năng đặt lại mật khẩu thật.
- Cấu trúc đề ĐGNL là cấu hình tham khảo, admin tự khai báo khi ghép đề — chưa cố định theo đề thi thật của một đại học cụ thể.
- Chưa rà soát pháp lý đầy đủ theo Nghị định 13/2023/NĐ-CP.
- Frontend chưa có cấu hình production serve qua Nginx với reverse proxy `/api`.
- Các thư viện `react-hook-form`, `zod`, `recharts` đã cài đặt nhưng chưa được dùng ở bất kỳ component nào trong `frontend/src/`.
