import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  adminFactory,
  body,
  createTestApp,
  IdBody,
  registerFactory,
  TokenBody,
} from './utils';

// Bộ test bao phủ các luồng cốt lõi của mô hình B2C thuần: đăng ký luôn tạo
// STUDENT, ADMIN quản lý toàn bộ nội dung, học sinh tự chọn đề thi để làm
// (không còn lớp học), chấm điểm tức thời, nhãn điểm AI tham khảo, ADMIN hậu
// kiểm điểm Văn, lộ trình AI sau khi chấm, và chặn route theo vai trò.

interface ExamQuestionBody {
  question: { correctAnswer?: unknown };
}
interface AnswerBody {
  id: string;
  isAiReferenceOnly: boolean;
  scoreAwarded: number | null;
}
interface AttemptBody {
  status: string;
  totalScore: number | null;
  answers: AnswerBody[];
}
interface WeaknessBody {
  weakTopics: unknown[];
}
interface RoadmapBody {
  stages: unknown[];
}

describe('Core flows (e2e)', () => {
  let app: INestApplication<App>;
  let register: ReturnType<typeof registerFactory>;
  let makeAdmin: ReturnType<typeof adminFactory>;
  const suffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    register = registerFactory(app);
    makeAdmin = adminFactory(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('1: registers and logs in a student; the register payload cannot force a different role', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email: `student1_${suffix}@test.dev`,
        password: 'password123',
        fullName: 'Student One',
        // Cố tình gửi kèm role/tenantName — phải bị bỏ qua hoàn toàn.
        role: 'ADMIN',
        tenantName: 'Should be ignored',
      })
      .expect(201);
    const studentToken = body<TokenBody>(res).accessToken;
    expect(typeof studentToken).toBe('string');

    const loginRes = await request(server())
      .post('/auth/login')
      .send({ email: `student1_${suffix}@test.dev`, password: 'password123' })
      .expect(200);
    expect(body<TokenBody>(loginRes).accessToken).toBeDefined();

    // Nếu payload role='ADMIN' bị tôn trọng, endpoint admin-only sẽ trả 200 thay vì 403.
    await request(server())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('2: an ADMIN account can only be provisioned directly (not via public register)', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin2_${suffix}@test.dev`,
    );
    await request(server())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('3-4: attempt lifecycle hides correctAnswer, any logged-in student can access an existing exam', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin3_${suffix}@test.dev`,
    );
    const { accessToken: studentToken } = await register({
      email: `student3_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Three',
    });

    const subjectRes = await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `SUB${suffix}`, name: 'Subject e2e' })
      .expect(201);
    const subject = body<IdBody>(subjectRes);
    const topicRes = await request(server())
      .post(`/subjects/${subject.id}/topics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Topic e2e' })
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
        content: 'e2e question',
        options: ['a', 'b'],
        correctAnswer: { index: 1 },
      })
      .expect(201);
    const question = body<IdBody>(questionRes);

    const examRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Exam e2e', subjectId: subject.id, durationMinutes: 10 })
      .expect(201);
    const exam = body<IdBody>(examRes);
    await request(server())
      .post(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: question.id, order: 1, maxScore: 0.25 })
      .expect(201);

    // Đề mới tạo thủ công luôn bắt đầu ở DRAFT (xem exams.controller.ts) —
    // phải publish trước khi học sinh có thể bắt đầu làm bài.
    await request(server())
      .post(`/exams/${exam.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    // Bất kỳ học sinh nào cũng truy cập được đề đã tồn tại — không còn giới hạn theo lớp.
    const attemptRes = await request(server())
      .post(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    const attempt = body<IdBody>(attemptRes);

    // Đáp án đúng không được xuất hiện trong response dành cho học sinh khi đang làm bài
    const examQuestionsRes = await request(server())
      .get(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const examQuestions = body<ExamQuestionBody[]>(examQuestionsRes);
    expect(examQuestions[0].question.correctAnswer).toBeUndefined();

    await request(server())
      .post(`/exams/attempts/${attempt.id}/answers`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: question.id, response: { index: 1 } })
      .expect(201);

    const submittedRes = await request(server())
      .post(`/grading/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    const submitted = body<AttemptBody>(submittedRes);
    expect(submitted.status).toBe('GRADED');
    expect(submitted.totalScore).toBe(0.25);
  });

  it('5: only ADMIN can create subjects, questions, and exams', async () => {
    const { accessToken: studentToken } = await register({
      email: `student5_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Five',
    });

    await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ code: 'X', name: 'X' })
      .expect(403);

    await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        subjectId: 'irrelevant',
        topicId: 'irrelevant',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'KNOWLEDGE',
        content: 'x',
      })
      .expect(403);

    await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'x', subjectId: 'irrelevant', durationMinutes: 10 })
      .expect(403);
  });

  it('6-7: essay with content held as PENDING_REVIEW when Gemini is not configured; ADMIN grades it manually', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin6_${suffix}@test.dev`,
    );
    const { accessToken: studentToken } = await register({
      email: `student6_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Six',
    });

    const subjectRes = await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `VAN${suffix}`, name: 'Văn' })
      .expect(201);
    const subject = body<IdBody>(subjectRes);
    const topicRes = await request(server())
      .post(`/subjects/${subject.id}/topics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nghị luận' })
      .expect(201);
    const topic = body<IdBody>(topicRes);
    const essayRes = await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: subject.id,
        topicId: topic.id,
        type: 'ESSAY',
        difficulty: 'KNOWLEDGE',
        content: 'Viết đoạn văn',
      })
      .expect(201);
    const essayQuestion = body<IdBody>(essayRes);

    const examRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'KT Văn', subjectId: subject.id, durationMinutes: 20 })
      .expect(201);
    const exam = body<IdBody>(examRes);
    await request(server())
      .post(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: essayQuestion.id, order: 1, maxScore: 3 })
      .expect(201);
    await request(server())
      .post(`/exams/${exam.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const attemptRes = await request(server())
      .post(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    const attempt = body<IdBody>(attemptRes);
    await request(server())
      .post(`/exams/attempts/${attempt.id}/answers`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        questionId: essayQuestion.id,
        response: { text: 'bài làm của học sinh' },
      })
      .expect(201);
    const submittedRes = await request(server())
      .post(`/grading/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    const submitted = body<AttemptBody>(submittedRes);
    // Bài có nội dung nhưng GEMINI_API_KEY không cấu hình trong môi trường
    // test — không tự chấm theo số từ, chờ ADMIN chấm tay (xem P0 issue #1).
    expect(submitted.status).toBe('PENDING_REVIEW');
    const pendingAnswer = submitted.answers[0];
    expect(pendingAnswer.isAiReferenceOnly).toBe(false);
    expect(pendingAnswer.scoreAwarded).toBeNull();

    // ADMIN chấm tay lần đầu — đây là câu tự luận duy nhất nên attempt tự
    // chuyển GRADED ngay khi chấm xong.
    const reviewedRes = await request(server())
      .post(`/grading/answers/${pendingAnswer.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ finalScore: 2.5, comment: 'Khá tốt' })
      .expect(201);
    const reviewed = body<AttemptBody>(reviewedRes);
    expect(reviewed.status).toBe('GRADED');
    expect(reviewed.totalScore).toBe(2.5);

    // Học sinh không phải ADMIN không được tự duyệt lại điểm của mình.
    await request(server())
      .post(`/grading/answers/${pendingAnswer.id}/review`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ finalScore: 3 })
      .expect(403);
  });

  it('8: study roadmap appears after an attempt is fully graded with a weak topic', async () => {
    const { accessToken: adminToken } = await makeAdmin(
      `admin8_${suffix}@test.dev`,
    );
    const { accessToken: studentToken } = await register({
      email: `student8_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Eight',
    });

    const subjectRes = await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `RM${suffix}`, name: 'Roadmap subject' })
      .expect(201);
    const subject = body<IdBody>(subjectRes);
    const topicRes = await request(server())
      .post(`/subjects/${subject.id}/topics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Roadmap topic' })
      .expect(201);
    const topic = body<IdBody>(topicRes);
    const q1Res = await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: subject.id,
        topicId: topic.id,
        type: 'MULTIPLE_CHOICE',
        difficulty: 'KNOWLEDGE',
        content: 'q1',
        options: ['a', 'b'],
        correctAnswer: { index: 0 },
      })
      .expect(201);
    const q1 = body<IdBody>(q1Res);
    const q2Res = await request(server())
      .post('/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: subject.id,
        topicId: topic.id,
        type: 'MULTIPLE_CHOICE',
        difficulty: 'KNOWLEDGE',
        content: 'q2',
        options: ['a', 'b'],
        correctAnswer: { index: 0 },
      })
      .expect(201);
    const q2 = body<IdBody>(q2Res);

    const examRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Roadmap exam',
        subjectId: subject.id,
        durationMinutes: 10,
      })
      .expect(201);
    const exam = body<IdBody>(examRes);
    await request(server())
      .post(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: q1.id, order: 1, maxScore: 0.25 })
      .expect(201);
    await request(server())
      .post(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: q2.id, order: 2, maxScore: 0.25 })
      .expect(201);
    await request(server())
      .post(`/exams/${exam.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const attemptRes = await request(server())
      .post(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    const attempt = body<IdBody>(attemptRes);
    // Trả lời sai cả hai câu để tạo điểm yếu
    await request(server())
      .post(`/exams/attempts/${attempt.id}/answers`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: q1.id, response: { index: 1 } })
      .expect(201);
    await request(server())
      .post(`/exams/attempts/${attempt.id}/answers`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: q2.id, response: { index: 1 } })
      .expect(201);
    await request(server())
      .post(`/grading/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);

    const weaknessesRes = await request(server())
      .get('/roadmap/me/weaknesses')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const weaknesses = body<WeaknessBody[]>(weaknessesRes);
    expect(weaknesses.length).toBeGreaterThan(0);
    expect(weaknesses[0].weakTopics.length).toBeGreaterThan(0);

    const roadmapRes = await request(server())
      .get('/roadmap/me/study-roadmap')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const roadmap = body<RoadmapBody[]>(roadmapRes);
    expect(roadmap.length).toBeGreaterThan(0);
    expect(roadmap[0].stages.length).toBe(4);
  });

  it('9: routes are blocked by role (RBAC)', async () => {
    const { accessToken: studentToken } = await register({
      email: `student9_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Nine',
    });

    // Học sinh không được tạo môn học (admin-only)
    await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ code: 'Y', name: 'Y' })
      .expect(403);

    // Học sinh không được truy cập route quản trị
    await request(server())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    // Không có token -> 401
    await request(server()).get('/admin/stats').expect(401);
  });

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
});
