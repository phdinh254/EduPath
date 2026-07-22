# EduPath

**EduPath** là hệ thống web luyện thi thử dành cho học sinh lớp 12 đang chuẩn bị cho kỳ thi tốt nghiệp THPT. Hệ thống giúp học sinh làm đề, luyện tập theo từng chuyên đề, theo dõi kết quả và nhận lộ trình ôn tập cá nhân hóa dựa trên trí tuệ nhân tạo.

## Mục tiêu dự án

Dự án hướng đến việc xây dựng một nền tảng học tập thông minh, giúp học sinh nhận biết chính xác những phần kiến thức còn yếu thay vì chỉ xem điểm số tổng quát. Sau mỗi lần làm bài, hệ thống sẽ phân tích kết quả, xác định chuyên đề học sinh thường mắc lỗi và đề xuất nội dung cần ôn tập tiếp theo.

Giáo viên và trung tâm có thể sử dụng hệ thống để tạo lớp học, quản lý học sinh, xây dựng đề thi riêng, theo dõi tiến độ và hỗ trợ học sinh cải thiện năng lực.

## Đối tượng sử dụng

| Đối tượng | Mục đích sử dụng |
|---|---|
| Học sinh | Làm đề, luyện chuyên đề, xem điểm, nhận phân tích năng lực và lộ trình học cá nhân |
| Giáo viên hoặc trung tâm | Quản lý lớp, mời học sinh, tạo đề riêng, theo dõi kết quả và duyệt điểm tự luận |
| Quản trị viên | Quản lý toàn bộ tài khoản, nội dung, ngân hàng câu hỏi và hoạt động hệ thống |

Hệ thống áp dụng mô hình B2B2C tự phục vụ. Giáo viên hoặc trung tâm có thể tự đăng ký, tạo lớp và mời học sinh bằng mã lớp hoặc liên kết mời. Học sinh cũng có thể tự đăng ký để sử dụng hệ thống mà không cần thuộc lớp nào.

Một học sinh có thể thuộc nhiều lớp hoặc nhiều trung tâm khác nhau cùng lúc, hoặc chuyển lớp giữa năm học. Vì vậy, quan hệ giữa học sinh và lớp/trung tâm được thiết kế theo dạng **nhiều-nhiều**, không phải một học sinh chỉ gắn cố định với một lớp duy nhất.

## Chức năng chính

Học sinh có thể đăng ký, đăng nhập, làm bài thi thử theo môn, luyện tập theo chuyên đề và mức độ khó, làm bài trong thời gian quy định, nộp bài và nhận kết quả. Hệ thống lưu lại lịch sử làm bài, điểm số, thời gian hoàn thành, câu trả lời đúng sai và các nội dung cần cải thiện.

Đề thi bám sát cấu trúc đề thi tốt nghiệp THPT áp dụng từ năm 2025. Với các môn thi trắc nghiệm, đề gồm ba dạng câu hỏi:
- Trắc nghiệm nhiều lựa chọn (chấm 0,25 điểm/câu)
- Dạng đúng/sai với thang điểm lũy tiến theo số ý đúng
- Dạng trắc nghiệm trả lời ngắn

Riêng môn Ngữ văn thi theo hình thức tự luận gồm hai phần Đọc hiểu và Viết, không áp dụng cách chấm tự động mà xử lý qua luồng chấm bài tự luận riêng (AI). Hệ thống chấm điểm cần xử lý đúng cả ba dạng câu hỏi trắc nghiệm nói trên, không chỉ dạng một đáp án đúng truyền thống.

Giáo viên có thể tạo lớp học, mời hoặc xóa học sinh trong lớp, tạo câu hỏi và đề thi riêng, xem kết quả của học sinh thuộc lớp mình, theo dõi tiến độ học tập và đưa ra nhận xét. Các câu hỏi do giáo viên tạo chỉ thuộc phạm vi lớp hoặc trung tâm của giáo viên đó, không ảnh hưởng đến ngân hàng câu hỏi dùng chung.

Quản trị viên có quyền quản lý tài khoản, môn học, chuyên đề, đề thi và ngân hàng câu hỏi gốc. Giáo viên có thể đề xuất câu hỏi chất lượng đưa vào kho dùng chung, nhưng nội dung phải được quản trị viên kiểm tra và phê duyệt trước khi sử dụng toàn hệ thống. Nội dung đề xuất phải do giáo viên tự biên soạn, không được sao chép nguyên văn đề thi chính thức của Bộ Giáo dục và Đào tạo hoặc tài liệu có bản quyền của bên thứ ba; đây là tiêu chí bắt buộc trong bước phê duyệt.

## Chức năng AI cá nhân hóa

Sau mỗi bài thi, AI sẽ phân tích tỷ lệ đúng theo từng môn, chương, chuyên đề và mức độ câu hỏi. Hệ thống cũng có thể xem xét thời gian làm bài, dạng câu hỏi thường sai và kết quả qua nhiều lần kiểm tra để xác định điểm yếu thực sự của học sinh.

Dựa trên kết quả phân tích, AI sẽ đề xuất các chủ đề cần ưu tiên, bài học nên ôn lại, bài tập phù hợp và lộ trình học theo từng giai đoạn. Lộ trình có thể được điều chỉnh sau mỗi lần học sinh làm bài mới.

Ví dụ, học sinh đạt 5,8 điểm và thường sai các câu về hàm số, nguyên hàm và xác suất. Hệ thống có thể xác định hàm số là nội dung cần ưu tiên, sau đó đề xuất ôn lý thuyết nền tảng, làm bài cơ bản, luyện bài vận dụng và kiểm tra lại sau một khoảng thời gian.

Đối với bài tự luận môn Ngữ văn, AI có thể hỗ trợ chấm và đưa ra nhận xét sơ bộ. Nếu học sinh thuộc lớp giáo viên, điểm AI sẽ được giáo viên duyệt hoặc điều chỉnh trước khi công bố chính thức. Nếu học sinh tự học, điểm AI được trả trực tiếp nhưng phải hiển thị rõ là **điểm tham khảo do AI đánh giá**.

## Phân quyền hệ thống

| Vai trò | Quyền hạn |
|---|---|
| Học sinh | Làm đề, luyện chuyên đề, xem lời giải, xem lịch sử, nhận phân tích điểm yếu và lộ trình AI của chính mình |
| Giáo viên | Tạo lớp, mời học sinh, quản lý học sinh trong lớp, tạo và quản lý nội dung riêng, xem kết quả học sinh thuộc lớp, duyệt điểm Văn do AI chấm |
| Quản trị viên | Quản lý tài khoản, giáo viên, trung tâm, môn học, đề thi, ngân hàng câu hỏi dùng chung, phê duyệt nội dung và xem thống kê toàn hệ thống |

Học sinh chỉ được xem dữ liệu của bản thân. Giáo viên chỉ được xem dữ liệu của học sinh trong lớp mình. Các quyền này phải được kiểm tra ở backend bằng cơ chế xác thực JWT và phân quyền RBAC, không chỉ kiểm soát bằng giao diện frontend.

## Tuân thủ và bảo mật dữ liệu

Phần lớn học sinh sử dụng hệ thống là học sinh lớp 12, dưới 18 tuổi. Việc thu thập, lưu trữ và xử lý dữ liệu của nhóm người dùng này cần tuân thủ quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, đặc biệt là các yêu cầu riêng đối với dữ liệu trẻ em theo Nghị định 13/2023/NĐ-CP. Trước khi ra mắt chính thức hoặc bổ sung các tính năng thu thập thêm dữ liệu (như tính năng dành cho phụ huynh), dự án nên được rà soát bởi người có chuyên môn pháp lý để đảm bảo tuân thủ đầy đủ.

## Kiến trúc kỹ thuật

### Frontend
React + TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Axios, TanStack Query, React Hook Form + Zod, Recharts. Test: Vitest, React Testing Library, Playwright.

### Backend
NestJS + TypeScript, kiến trúc Module/Controller/Service/Repository, Prisma ORM, PostgreSQL, JWT + Passport, Argon2/bcrypt, class-validator/class-transformer, Swagger/OpenAPI. Test: Jest, Supertest.

### AI
MVP: NestJS gọi trực tiếp LLM API để phân tích kết quả và tạo lộ trình. Khi cần mô hình phân tích riêng: tách AI Service bằng Python + FastAPI + Pandas + scikit-learn.

### Cơ sở dữ liệu chính (PostgreSQL)
`User`, `Role`, `Tenant`, `Class`, `StudentClass`, `Subject`, `Topic`, `Question`, `Exam`, `ExamAttempt`, `Answer`, `Score`, `WeaknessAnalysis`, `StudyRoadmap`, `TeacherReview`, `AuditLog`.

Mỗi giáo viên/trung tâm được quản lý như một tenant riêng. Giáo viên chỉ truy cập lớp, học sinh, nội dung thuộc tenant của mình. Ngân hàng câu hỏi dùng chung thuộc quyền quản lý của quản trị viên.

### DevOps
Docker, Docker Compose, Nginx reverse proxy, Git/GitHub, GitHub Actions CI/CD, deploy VPS/Render/Railway/AWS, file storage S3-compatible.

### Cấu trúc thư mục
```
frontend/
backend/
ai-service/
devops/
docs/
```

Phiên bản đầu tiên chưa cần tách microservice — một backend NestJS tổ chức theo module và phân tầng là đủ. Khi số lượng người dùng tăng, AI Service, Notification Service hoặc Report Service có thể tách riêng.
