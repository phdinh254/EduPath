import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Bộ test bao phủ các luồng cốt lõi yêu cầu bởi tích hợp frontend <-> backend:
// đăng ký/đăng nhập theo vai trò, tạo lớp, tham gia bằng mã mời, làm bài,
// ẩn đáp án đúng, RBAC theo tenant, duyệt điểm Văn, nhãn điểm AI tham khảo,
// lộ trình AI sau khi chấm, và chặn route theo vai trò.

interface IdBody {
  id: string;
}
interface TokenBody {
  accessToken: string;
}
interface ClassBody {
  id: string;
  inviteCode: string;
}
interface StudentClassBody {
  class: { name: string };
}
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

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Core flows (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function register(payload: Record<string, unknown>): Promise<string> {
    const res = await request(server())
      .post('/auth/register')
      .send(payload)
      .expect(201);
    return body<TokenBody>(res).accessToken;
  }

  it('1-2: registers and logs in a student and a teacher', async () => {
    const studentToken = await register({
      email: `student1_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student One',
      role: 'STUDENT',
    });
    expect(typeof studentToken).toBe('string');

    const loginRes = await request(server())
      .post('/auth/login')
      .send({ email: `student1_${suffix}@test.dev`, password: 'password123' })
      .expect(200);
    expect(body<TokenBody>(loginRes).accessToken).toBeDefined();

    const teacherToken = await register({
      email: `teacher1_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher One',
      role: 'TEACHER',
      tenantName: `Tenant One ${suffix}`,
    });
    expect(typeof teacherToken).toBe('string');
  });

  it('3-4: teacher creates a class, student joins it by invite code', async () => {
    const teacherToken = await register({
      email: `teacher2_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher Two',
      role: 'TEACHER',
      tenantName: `Tenant Two ${suffix}`,
    });
    const studentToken = await register({
      email: `student2_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Two',
      role: 'STUDENT',
    });

    const classRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Lớp e2e' })
      .expect(201);
    const { inviteCode } = body<ClassBody>(classRes);
    expect(inviteCode).toHaveLength(8);

    await request(server())
      .post('/classes/join')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ inviteCode })
      .expect(201);

    const mine = await request(server())
      .get('/classes/mine')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const mineBody = body<StudentClassBody[]>(mine);
    expect(mineBody).toHaveLength(1);
    expect(mineBody[0].class.name).toBe('Lớp e2e');
  });

  it('5-6-7: attempt lifecycle hides correctAnswer, rejects a student outside the class', async () => {
    const adminToken = await register({
      email: `admin1_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Admin One',
      role: 'ADMIN',
    });
    const teacherToken = await register({
      email: `teacher3_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher Three',
      role: 'TEACHER',
      tenantName: `Tenant Three ${suffix}`,
    });
    const insiderToken = await register({
      email: `student3_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Insider',
      role: 'STUDENT',
    });
    const outsiderToken = await register({
      email: `student4_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Outsider',
      role: 'STUDENT',
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

    const klassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Lớp attempt' })
      .expect(201);
    const klass = body<ClassBody>(klassRes);
    await request(server())
      .post('/classes/join')
      .set('Authorization', `Bearer ${insiderToken}`)
      .send({ inviteCode: klass.inviteCode })
      .expect(201);

    const examRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Exam e2e',
        subjectId: subject.id,
        durationMinutes: 10,
        classId: klass.id,
      })
      .expect(201);
    const exam = body<IdBody>(examRes);
    await request(server())
      .post(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ questionId: question.id, order: 1, maxScore: 0.25 })
      .expect(201);

    // Học sinh ngoài lớp bị từ chối khi truy cập đề riêng
    await request(server())
      .post(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    const attemptRes = await request(server())
      .post(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${insiderToken}`)
      .expect(201);
    const attempt = body<IdBody>(attemptRes);

    // Đáp án đúng không được xuất hiện trong response dành cho học sinh khi đang làm bài
    const examQuestionsRes = await request(server())
      .get(`/exams/${exam.id}/questions`)
      .set('Authorization', `Bearer ${insiderToken}`)
      .expect(200);
    const examQuestions = body<ExamQuestionBody[]>(examQuestionsRes);
    expect(examQuestions[0].question.correctAnswer).toBeUndefined();

    await request(server())
      .post(`/exams/attempts/${attempt.id}/answers`)
      .set('Authorization', `Bearer ${insiderToken}`)
      .send({ questionId: question.id, response: { index: 1 } })
      .expect(201);

    const submittedRes = await request(server())
      .post(`/grading/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${insiderToken}`)
      .expect(201);
    const submitted = body<AttemptBody>(submittedRes);
    expect(submitted.status).toBe('GRADED');
    expect(submitted.totalScore).toBe(0.25);
  });

  it('8: teacher cannot access another tenant exam attempts', async () => {
    const adminToken = await register({
      email: `admin2_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Admin Two',
      role: 'ADMIN',
    });
    const ownerTeacherToken = await register({
      email: `teacher4_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher Four',
      role: 'TEACHER',
      tenantName: `Tenant Four ${suffix}`,
    });
    const outsiderTeacherToken = await register({
      email: `teacher5_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher Five',
      role: 'TEACHER',
      tenantName: `Tenant Five ${suffix}`,
    });

    const subjectRes = await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `SUB2${suffix}`, name: 'Subject two' })
      .expect(201);
    const subject = body<IdBody>(subjectRes);
    const examRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${ownerTeacherToken}`)
      .send({
        title: 'Owner-only exam',
        subjectId: subject.id,
        durationMinutes: 10,
      })
      .expect(201);
    const exam = body<IdBody>(examRes);

    await request(server())
      .get(`/exams/${exam.id}/attempts`)
      .set('Authorization', `Bearer ${outsiderTeacherToken}`)
      .expect(403);
  });

  it('9-10: teacher reviews an essay (class exam); self-study essay gets the AI-reference label', async () => {
    const adminToken = await register({
      email: `admin3_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Admin Three',
      role: 'ADMIN',
    });
    const teacherToken = await register({
      email: `teacher6_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher Six',
      role: 'TEACHER',
      tenantName: `Tenant Six ${suffix}`,
    });
    const classStudentToken = await register({
      email: `student5_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Five',
      role: 'STUDENT',
    });
    const selfStudyToken = await register({
      email: `student6_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Six',
      role: 'STUDENT',
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

    const klassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Lớp Văn' })
      .expect(201);
    const klass = body<ClassBody>(klassRes);
    await request(server())
      .post('/classes/join')
      .set('Authorization', `Bearer ${classStudentToken}`)
      .send({ inviteCode: klass.inviteCode })
      .expect(201);

    // Đề gắn với lớp -> chờ giáo viên duyệt
    const classExamRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'KT Văn lớp',
        subjectId: subject.id,
        durationMinutes: 20,
        classId: klass.id,
      })
      .expect(201);
    const classExam = body<IdBody>(classExamRes);
    await request(server())
      .post(`/exams/${classExam.id}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ questionId: essayQuestion.id, order: 1, maxScore: 3 })
      .expect(201);

    const classAttemptRes = await request(server())
      .post(`/exams/${classExam.id}/attempts`)
      .set('Authorization', `Bearer ${classStudentToken}`)
      .expect(201);
    const classAttempt = body<IdBody>(classAttemptRes);
    await request(server())
      .post(`/exams/attempts/${classAttempt.id}/answers`)
      .set('Authorization', `Bearer ${classStudentToken}`)
      .send({
        questionId: essayQuestion.id,
        response: { text: 'bài làm của học sinh trong lớp' },
      })
      .expect(201);
    const classSubmittedRes = await request(server())
      .post(`/grading/attempts/${classAttempt.id}/submit`)
      .set('Authorization', `Bearer ${classStudentToken}`)
      .expect(201);
    const classSubmitted = body<AttemptBody>(classSubmittedRes);
    expect(classSubmitted.status).toBe('SUBMITTED'); // chờ giáo viên duyệt
    const pendingAnswer = classSubmitted.answers[0];
    expect(pendingAnswer.isAiReferenceOnly).toBe(false);
    expect(pendingAnswer.scoreAwarded).toBeNull();

    const reviewedRes = await request(server())
      .post(`/grading/answers/${pendingAnswer.id}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ finalScore: 2.5, comment: 'Khá tốt' })
      .expect(201);
    const reviewed = body<AttemptBody>(reviewedRes);
    expect(reviewed.status).toBe('GRADED');
    expect(reviewed.totalScore).toBe(2.5);

    // Đề không gắn lớp -> tự học -> điểm AI công bố trực tiếp, có nhãn tham khảo
    const selfStudyExamRes = await request(server())
      .post('/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'KT Văn tự học',
        subjectId: subject.id,
        durationMinutes: 20,
      })
      .expect(201);
    const selfStudyExam = body<IdBody>(selfStudyExamRes);
    await request(server())
      .post(`/exams/${selfStudyExam.id}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: essayQuestion.id, order: 1, maxScore: 3 })
      .expect(201);
    const selfAttemptRes = await request(server())
      .post(`/exams/${selfStudyExam.id}/attempts`)
      .set('Authorization', `Bearer ${selfStudyToken}`)
      .expect(201);
    const selfAttempt = body<IdBody>(selfAttemptRes);
    await request(server())
      .post(`/exams/attempts/${selfAttempt.id}/answers`)
      .set('Authorization', `Bearer ${selfStudyToken}`)
      .send({
        questionId: essayQuestion.id,
        response: { text: 'bài làm tự học không thuộc lớp nào' },
      })
      .expect(201);
    const selfSubmittedRes = await request(server())
      .post(`/grading/attempts/${selfAttempt.id}/submit`)
      .set('Authorization', `Bearer ${selfStudyToken}`)
      .expect(201);
    const selfSubmitted = body<AttemptBody>(selfSubmittedRes);
    expect(selfSubmitted.status).toBe('GRADED');
    const aiAnswer = selfSubmitted.answers[0];
    expect(aiAnswer.isAiReferenceOnly).toBe(true);
    expect(aiAnswer.scoreAwarded).not.toBeNull();
  });

  it('11: study roadmap appears after an attempt is fully graded with a weak topic', async () => {
    const adminToken = await register({
      email: `admin4_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Admin Four',
      role: 'ADMIN',
    });
    const studentToken = await register({
      email: `student7_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Seven',
      role: 'STUDENT',
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

  it('12: routes are blocked by role (RBAC)', async () => {
    const studentToken = await register({
      email: `student8_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Student Eight',
      role: 'STUDENT',
    });
    const teacherToken = await register({
      email: `teacher7_${suffix}@test.dev`,
      password: 'password123',
      fullName: 'Teacher Seven',
      role: 'TEACHER',
      tenantName: `Tenant Seven ${suffix}`,
    });

    // Học sinh không được tạo môn học (admin-only)
    await request(server())
      .post('/subjects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ code: 'X', name: 'X' })
      .expect(403);

    // Giáo viên không được truy cập route quản trị
    await request(server())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(403);

    // Học sinh không được truy cập route quản trị
    await request(server())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    // Không có token -> 401
    await request(server()).get('/admin/stats').expect(401);
  });
});
