import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  ContentStatus,
  ExamCategory,
  ExamPublishStatus,
  ExamPurpose,
  ExamVisibility,
  Prisma,
  QuestionType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { QuestionsService } from '../questions/questions.service';
import { GradingService } from '../grading/grading.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { GenerateTopicPracticeDto } from './dto/generate-topic-practice.dto';
import { toPaginatedResult, toSkipTake } from '../common/pagination.util';

const EXAM_DETAIL_INCLUDE = {
  sections: { orderBy: { order: 'asc' as const } },
  examQuestions: {
    include: { question: true },
    orderBy: { order: 'asc' as const },
  },
};

// Học sinh tự chọn đề để thi thử/ôn tập — không còn khái niệm lớp học, mọi đề
// đã tồn tại đều mở cho tất cả học sinh. Chỉ ADMIN quản lý nội dung đề thi.
@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
    private readonly gradingService: GradingService,
  ) {}

  // Tạo đề thủ công — chỉ ADMIN dùng (xem generateExam() cho luồng AI ghép đề
  // tự động, vốn là luồng chính). Luôn bắt đầu ở DRAFT: đề trống chưa có câu
  // hỏi nào không được hiện với học sinh cho tới khi ADMIN gọi publish().
  async create(user: JwtPayload, dto: CreateExamDto) {
    const category = dto.category ?? ExamCategory.THPT;
    if (category === ExamCategory.THPT && !dto.subjectId) {
      throw new BadRequestException('Đề THPT cần chỉ định subjectId');
    }
    return this.prisma.exam.create({
      data: {
        title: dto.title,
        category,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes,
        createdById: user.sub,
        visibility: ExamVisibility.PUBLIC,
        status: ExamPublishStatus.DRAFT,
        purpose: ExamPurpose.OFFICIAL,
      },
    });
  }

  // ADMIN xác nhận đề thủ công (create()) đã đủ câu hỏi và sẵn sàng cho học
  // sinh — tách khỏi create() vì lúc tạo đề luôn chưa có câu hỏi nào.
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

  // Rút đề khỏi danh sách khám phá của học sinh — lịch sử làm bài cũ (nếu có)
  // vẫn giữ nguyên vì ExamAttempt tham chiếu examId, không xoá đề.
  async archive(examId: string, user: JwtPayload) {
    this.assertAdminOnly(user);
    await this.findExamOrThrow(examId);
    return this.prisma.exam.update({
      where: { id: examId },
      data: { status: ExamPublishStatus.ARCHIVED },
    });
  }

  // STUDENT chỉ được xem đề PUBLIC+PUBLISHED của người khác, hoặc đề của
  // chính mình (đề luyện cá nhân PRIVATE) — dùng NotFoundException thay vì
  // Forbidden để không lộ sự tồn tại của đề riêng người khác qua việc đoán ID.
  private assertVisibleOrNotFound(
    exam: {
      createdById: string;
      visibility: ExamVisibility;
      status: ExamPublishStatus;
    },
    user: JwtPayload,
  ) {
    if (user.role === Role.ADMIN) return;
    if (exam.createdById === user.sub) return;
    if (
      exam.visibility === ExamVisibility.PUBLIC &&
      exam.status === ExamPublishStatus.PUBLISHED
    ) {
      return;
    }
    throw new NotFoundException('Không tìm thấy đề thi');
  }

  // AI ghép đề hoàn chỉnh tự động: THPT lấy từ ngân hàng câu hỏi 1 môn (trắc
  // nghiệm 3 dạng hoặc tự luận Văn); ĐGNL chia nhiều section theo môn, tổng
  // thang điểm 150. Câu hỏi được lấy từ kho đã duyệt, AI sinh bù tức thời nếu
  // thiếu để đề luôn sẵn sàng ngay (xem QuestionsService.pickOrSynthesizeQuestions).
  async generateExam(user: JwtPayload, dto: GenerateExamDto) {
    if (dto.category === ExamCategory.DGNL) {
      return this.generateDgnlExam(user, dto);
    }
    return this.generateThptExam(user, dto);
  }

  // Số câu theo dạng × mức độ khó luôn lấy từ ExamStructure cố định của môn
  // (khai báo qua SubjectsService.upsertExamStructure) — admin không còn tự
  // gõ số lượng mỗi lần ghép đề, đảm bảo mọi đề cùng môn đúng 1 khuôn chung.
  private async generateThptExam(user: JwtPayload, dto: GenerateExamDto) {
    if (!dto.subjectId) {
      throw new BadRequestException('Đề THPT cần chỉ định subjectId');
    }

    const structure = await this.prisma.examStructure.findUnique({
      where: { subjectId: dto.subjectId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!structure || structure.items.length === 0) {
      throw new BadRequestException(
        'Môn học chưa cấu hình cấu trúc đề — vào trang Môn học để khai báo trước khi ghép đề',
      );
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        category: ExamCategory.THPT,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes ?? structure.durationMinutes,
        createdById: user.sub,
        visibility: ExamVisibility.PUBLIC,
        status: ExamPublishStatus.PUBLISHED,
        purpose: ExamPurpose.OFFICIAL,
      },
    });

    let order = 1;
    // Tích luỹ id câu hỏi đã dùng trong chính đề này — tránh 2 item cùng
    // subjectId+type+difficulty (hoặc admin khai báo trùng) chọn trùng câu.
    const usedQuestionIds: string[] = [];
    try {
      for (const item of structure.items) {
        const questions = await this.questionsService.pickOrSynthesizeQuestions(
          {
            subjectId: dto.subjectId,
            type: item.type,
            difficulty: item.difficulty,
            count: item.questionCount,
            creatorId: user.sub,
            excludeIds: usedQuestionIds,
          },
        );
        for (const q of questions) {
          usedQuestionIds.push(q.id);
          await this.prisma.examQuestion.create({
            data: {
              examId: exam.id,
              questionId: q.id,
              order: order++,
              maxScore: item.maxScorePerQuestion,
            },
          });
        }
      }
    } catch (err) {
      // Không đủ câu hỏi đã duyệt (hoặc lỗi khác giữa chừng) — không để lại
      // đề rỗng/dở dang mà học sinh có thể lỡ thấy (xem P0 issue #3).
      await this.prisma.exam.delete({ where: { id: exam.id } });
      throw err;
    }
    return this.withDetails(exam.id);
  }

  // Section có thể lấy từ mẫu đề ĐGNL dùng chung (dgnlTemplateId — xem
  // DgnlTemplatesService, tổng đã được validate = 150 lúc tạo mẫu) hoặc admin
  // tự khai báo thủ công như trước (dto.sections) khi cần đề tuỳ biến riêng.
  private async resolveDgnlSections(dto: GenerateExamDto) {
    if (dto.dgnlTemplateId) {
      const template = await this.prisma.dgnlTemplate.findUnique({
        where: { id: dto.dgnlTemplateId },
        include: { sections: { orderBy: { order: 'asc' } } },
      });
      if (!template) {
        throw new BadRequestException('Không tìm thấy mẫu đề ĐGNL');
      }
      return template.sections.map((s) => ({
        name: s.name,
        subjectId: s.subjectId,
        questionCount: s.questionCount,
        maxScore: s.maxScore,
      }));
    }
    if (!dto.sections?.length) {
      throw new BadRequestException(
        'Đề ĐGNL cần chọn mẫu có sẵn (dgnlTemplateId) hoặc khai báo sections thủ công',
      );
    }
    return dto.sections;
  }

  private async generateDgnlExam(user: JwtPayload, dto: GenerateExamDto) {
    const sections = await this.resolveDgnlSections(dto);
    if (!dto.durationMinutes) {
      throw new BadRequestException('Đề ĐGNL cần chỉ định durationMinutes');
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        category: ExamCategory.DGNL,
        subjectId: null,
        durationMinutes: dto.durationMinutes,
        createdById: user.sub,
        visibility: ExamVisibility.PUBLIC,
        status: ExamPublishStatus.PUBLISHED,
        purpose: ExamPurpose.OFFICIAL,
      },
    });

    let order = 1;
    // Nhiều section ĐGNL có thể trỏ cùng subjectId (vd. mẫu đề dùng lại
    // "Toán học" cho cả 2 phần) — tích luỹ id câu hỏi đã dùng để không chọn
    // trùng câu giữa các section, tránh vi phạm unique (examId, questionId).
    const usedQuestionIds: string[] = [];
    try {
      for (const [i, section] of sections.entries()) {
        const examSection = await this.prisma.examSection.create({
          data: {
            examId: exam.id,
            name: section.name,
            order: i + 1,
            maxScore: section.maxScore,
          },
        });
        const perQuestionScore = section.maxScore / section.questionCount;
        const questions = await this.questionsService.pickOrSynthesizeQuestions(
          {
            subjectId: section.subjectId,
            type: QuestionType.MULTIPLE_CHOICE,
            count: section.questionCount,
            creatorId: user.sub,
            excludeIds: usedQuestionIds,
          },
        );
        for (const q of questions) {
          usedQuestionIds.push(q.id);
          await this.prisma.examQuestion.create({
            data: {
              examId: exam.id,
              questionId: q.id,
              sectionId: examSection.id,
              order: order++,
              maxScore: perQuestionScore,
            },
          });
        }
      }
    } catch (err) {
      // Không đủ câu hỏi đã duyệt cho một section (hoặc lỗi khác giữa
      // chừng) — không để lại đề rỗng/dở dang (xem P0 issue #3).
      await this.prisma.exam.delete({ where: { id: exam.id } });
      throw err;
    }
    return this.withDetails(exam.id);
  }

  // Học sinh tự khởi tạo đề luyện tập nhanh đúng một chuyên đề — dùng bởi nút
  // "Luyện ngay" trên trang lộ trình AI, để mỗi giai đoạn ôn tập gắn với hành
  // động thật thay vì chỉ là nhãn. Đề này riêng của học sinh (createdById =
  // chính họ), không cần ExamStructure vì chỉ luyện 1 chuyên đề, không phải
  // đề thi thử đầy đủ.
  async generateTopicPractice(user: JwtPayload, dto: GenerateTopicPracticeDto) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      include: { subject: true },
    });
    if (!topic) {
      throw new BadRequestException('Không tìm thấy chuyên đề');
    }
    const questionCount = dto.questionCount ?? 10;

    // Lấy câu hỏi TRƯỚC khi tạo Exam — pickQuestionsByTopic có thể báo lỗi
    // thiếu dữ liệu (không đủ câu đã duyệt), tránh để lại một đề rỗng mồ côi.
    const questions = await this.questionsService.pickQuestionsByTopic({
      topicId: dto.topicId,
      count: questionCount,
      creatorId: user.sub,
    });

    const exam = await this.prisma.exam.create({
      data: {
        title: `Luyện tập: ${topic.name}`,
        category: ExamCategory.THPT,
        subjectId: topic.subjectId,
        durationMinutes: Math.max(10, questionCount * 2),
        createdById: user.sub,
        // Đề riêng của học sinh này — không được lẫn vào danh sách khám phá
        // đề chung (xem findAllForUser).
        visibility: ExamVisibility.PRIVATE,
        status: ExamPublishStatus.PUBLISHED,
        purpose: ExamPurpose.PERSONAL_PRACTICE,
      },
    });

    let order = 1;
    for (const q of questions) {
      await this.prisma.examQuestion.create({
        data: {
          examId: exam.id,
          questionId: q.id,
          order: order++,
          maxScore: 0.25,
        },
      });
    }
    return this.withDetails(exam.id);
  }

  private withDetails(examId: string) {
    return this.prisma.exam.findUnique({
      where: { id: examId },
      include: EXAM_DETAIL_INCLUDE,
    });
  }

  private async findExamOrThrow(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundException('Không tìm thấy đề thi');
    }
    return exam;
  }

  private assertAdminOnly(user: JwtPayload) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ ADMIN mới có quyền thao tác đề thi');
    }
  }

  // Không còn lớp học/tenant scoping, nhưng vẫn phải tách bạch đề công khai
  // với đề luyện cá nhân (xem [[ExamVisibility]]):
  // - STUDENT: thấy đề PUBLIC+PUBLISHED (kho chung) + mọi đề của chính mình
  //   (đề luyện cá nhân PRIVATE, hoặc đề DRAFT/ARCHIVED nếu họ tự tạo).
  // - ADMIN: thấy mọi đề PUBLIC (kể cả DRAFT để tiếp tục soạn) nhưng KHÔNG
  //   thấy đề luyện cá nhân PRIVATE của học sinh — danh sách này phục vụ quản
  //   lý nội dung chính thức, không phải xem trộm đề luyện riêng.
  // Kèm số liệu khám phá đề (lượt làm, điểm trung bình, lượt thích) để hiển
  // thị dạng thẻ ở trang Đề thi.
  async findAllForUser(user: JwtPayload, page?: number, limit?: number) {
    const where: Prisma.ExamWhereInput =
      user.role === Role.ADMIN
        ? { visibility: ExamVisibility.PUBLIC }
        : {
            OR: [
              {
                visibility: ExamVisibility.PUBLIC,
                status: ExamPublishStatus.PUBLISHED,
              },
              { createdById: user.sub },
            ],
          };
    const {
      skip,
      take,
      page: safePage,
      limit: safeLimit,
    } = toSkipTake(page, limit);
    const [exams, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.exam.count({ where }),
    ]);
    if (exams.length === 0) {
      return toPaginatedResult([], total, safePage, safeLimit);
    }

    const examIds = exams.map((e) => e.id);

    const [attemptCounts, scores, likeCounts, myLikes] = await Promise.all([
      this.prisma.examAttempt.groupBy({
        by: ['examId'],
        where: { examId: { in: examIds } },
        _count: { _all: true },
      }),
      this.prisma.score.findMany({
        where: { attempt: { examId: { in: examIds } } },
        select: { totalScore: true, attempt: { select: { examId: true } } },
      }),
      this.prisma.examLike.groupBy({
        by: ['examId'],
        where: { examId: { in: examIds } },
        _count: { _all: true },
      }),
      user.role === Role.STUDENT
        ? this.prisma.examLike.findMany({
            where: { examId: { in: examIds }, studentId: user.sub },
            select: { examId: true },
          })
        : Promise.resolve<{ examId: string }[]>([]),
    ]);

    const attemptCountByExam = new Map(
      attemptCounts.map((a) => [a.examId, a._count._all]),
    );
    const likeCountByExam = new Map(
      likeCounts.map((l) => [l.examId, l._count._all]),
    );
    const likedExamIds = new Set(myLikes.map((l) => l.examId));

    const scoreSumByExam = new Map<string, { sum: number; count: number }>();
    for (const score of scores) {
      const examId = score.attempt.examId;
      const entry = scoreSumByExam.get(examId) ?? { sum: 0, count: 0 };
      entry.sum += score.totalScore;
      entry.count += 1;
      scoreSumByExam.set(examId, entry);
    }

    const data = exams.map((exam) => {
      const scoreEntry = scoreSumByExam.get(exam.id);
      return {
        ...exam,
        attemptCount: attemptCountByExam.get(exam.id) ?? 0,
        likeCount: likeCountByExam.get(exam.id) ?? 0,
        liked: likedExamIds.has(exam.id),
        avgScore: scoreEntry
          ? Math.round((scoreEntry.sum / scoreEntry.count) * 10) / 10
          : null,
      };
    });
    return toPaginatedResult(data, total, safePage, safeLimit);
  }

  // Học sinh bấm "thích" một đề thi khi đang khám phá đề — không ảnh hưởng
  // đến việc làm bài, chỉ phục vụ hiển thị lượt thích.
  async toggleLike(examId: string, user: JwtPayload) {
    const exam = await this.findExamOrThrow(examId);
    this.assertVisibleOrNotFound(exam, user);
    const existing = await this.prisma.examLike.findUnique({
      where: { examId_studentId: { examId, studentId: user.sub } },
    });
    if (existing) {
      await this.prisma.examLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.examLike.create({
        data: { examId, studentId: user.sub },
      });
    }
    const likeCount = await this.prisma.examLike.count({ where: { examId } });
    return { liked: !existing, likeCount };
  }

  async findOne(id: string, user: JwtPayload) {
    const exam = await this.findExamOrThrow(id);
    this.assertVisibleOrNotFound(exam, user);
    return this.prisma.exam.findUniqueOrThrow({
      where: { id },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }

  async addQuestion(examId: string, user: JwtPayload, dto: AddExamQuestionDto) {
    this.assertAdminOnly(user);
    const exam = await this.findExamOrThrow(examId);

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (question.status !== ContentStatus.APPROVED) {
      throw new ForbiddenException('Câu hỏi chưa ở kho dùng chung đã duyệt');
    }

    // Đề THPT gắn cứng 1 môn ở cấp Exam — câu hỏi phải cùng môn.
    if (exam.subjectId && question.subjectId !== exam.subjectId) {
      throw new BadRequestException(
        'Câu hỏi không cùng môn học với đề thi này',
      );
    }

    // Đề ĐGNL xác định môn theo section (Exam.subjectId để null) — bắt buộc
    // chỉ định sectionId, và section đó phải thuộc chính đề này.
    if (exam.category === ExamCategory.DGNL && !dto.sectionId) {
      throw new BadRequestException(
        'Đề ĐGNL cần chỉ định sectionId khi thêm câu hỏi',
      );
    }
    let section: { id: string; examId: string; maxScore: number } | null = null;
    if (dto.sectionId) {
      section = await this.prisma.examSection.findUnique({
        where: { id: dto.sectionId },
        select: { id: true, examId: true, maxScore: true },
      });
      if (!section || section.examId !== examId) {
        throw new BadRequestException('Section không thuộc đề thi này');
      }
    }

    // Thứ tự (order) không được trùng trong TOÀN BỘ đề, không chỉ trong section.
    const examWideQuestions = await this.prisma.examQuestion.findMany({
      where: { examId },
      select: { order: true },
    });
    if (examWideQuestions.some((eq) => eq.order === dto.order)) {
      throw new BadRequestException(
        `Thứ tự ${dto.order} đã được dùng trong đề này`,
      );
    }

    if (section) {
      const sectionQuestions = await this.prisma.examQuestion.findMany({
        where: { sectionId: section.id },
        select: { maxScore: true, question: { select: { subjectId: true } } },
      });
      // Câu hỏi phải cùng môn với các câu khác đã có trong section (ĐGNL có
      // thể nhiều section cùng môn, nhưng trong 1 section phải đồng nhất).
      if (
        sectionQuestions.some(
          (sq) => sq.question.subjectId !== question.subjectId,
        )
      ) {
        throw new BadRequestException(
          'Câu hỏi không cùng môn học với các câu khác trong section này',
        );
      }
      const usedScore = sectionQuestions.reduce(
        (sum, sq) => sum + sq.maxScore,
        0,
      );
      // Dung sai nhỏ cho lỗi làm tròn số thực (Float), không phải để cho phép vượt thật sự.
      if (usedScore + dto.maxScore > section.maxScore + 1e-6) {
        throw new BadRequestException(
          `Tổng điểm section sẽ vượt quá thang điểm cho phép (${section.maxScore}) — hiện đã dùng ${usedScore}`,
        );
      }
    }

    return this.prisma.examQuestion.create({
      data: {
        examId: exam.id,
        questionId: dto.questionId,
        sectionId: dto.sectionId,
        order: dto.order,
        maxScore: dto.maxScore,
      },
    });
  }

  async listQuestions(examId: string, user: JwtPayload) {
    const exam = await this.findOne(examId, user);
    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: exam.id },
      include: { question: true },
      orderBy: { order: 'asc' },
    });
    if (user.role === Role.STUDENT) {
      // Không lộ đáp án đúng cho học sinh khi đang làm bài
      return examQuestions.map(({ question, ...rest }) => ({
        ...rest,
        question: {
          id: question.id,
          type: question.type,
          difficulty: question.difficulty,
          content: question.content,
          options: question.options,
        },
      }));
    }
    return examQuestions;
  }

  // Đồng hồ đếm giờ chỉ là hiển thị phía client — nếu học sinh bỏ dở giữa
  // chừng (mất mạng, tắt tab) và không bao giờ bấm nộp, attempt sẽ ở
  // IN_PROGRESS mãi mãi. Kiểm tra "lười" (không cần cron riêng): mỗi khi có
  // ai chạm tới attempt này (mở lại đề, xem lại, lưu câu trả lời) mà phát
  // hiện đã quá giờ, tự nộp/chấm ngay tại đây bằng chính luồng chấm điểm
  // thật (GradingService.submitAttempt) — không viết lại logic chấm điểm.
  private async finalizeIfExpired(
    attempt: {
      id: string;
      studentId: string;
      status: AttemptStatus;
      startedAt: Date;
    },
    durationMinutes: number,
  ): Promise<boolean> {
    if (attempt.status !== AttemptStatus.IN_PROGRESS) return false;
    const deadline = attempt.startedAt.getTime() + durationMinutes * 60_000;
    if (Date.now() <= deadline) return false;
    await this.gradingService.submitAttempt(attempt.id, {
      sub: attempt.studentId,
      role: Role.STUDENT,
      email: '',
    });
    return true;
  }

  async startAttempt(examId: string, user: JwtPayload) {
    const exam = await this.findExamOrThrow(examId);
    this.assertVisibleOrNotFound(exam, user);

    const existingInProgress = await this.prisma.examAttempt.findFirst({
      where: {
        examId,
        studentId: user.sub,
        status: AttemptStatus.IN_PROGRESS,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existingInProgress) {
      const expired = await this.finalizeIfExpired(
        existingInProgress,
        exam.durationMinutes,
      );
      if (!expired) return existingInProgress;
      // Đã tự nộp bài quá hạn ở trên — để học sinh bắt đầu lượt làm mới bên dưới.
    }

    // Đọc rồi mới tạo có thể bị race nếu 2 request đến gần như đồng thời (double-click,
    // React StrictMode...). Dùng transaction isolation Serializable để Postgres tự phát
    // hiện xung đột; nếu bị serialization failure thì coi như đã có attempt, đọc lại.
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const inProgress = await tx.examAttempt.findFirst({
            where: {
              examId,
              studentId: user.sub,
              status: AttemptStatus.IN_PROGRESS,
            },
          });
          if (inProgress) {
            return inProgress;
          }
          return tx.examAttempt.create({
            data: { examId, studentId: user.sub },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch {
      const existing = await this.prisma.examAttempt.findFirst({
        where: {
          examId,
          studentId: user.sub,
          status: AttemptStatus.IN_PROGRESS,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) return existing;
      throw new BadRequestException(
        'Không thể bắt đầu lượt làm bài, vui lòng thử lại',
      );
    }
  }

  private async findAttemptOrThrow(id: string) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id } });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    return attempt;
  }

  // Đồng hồ đếm giờ ở frontend chỉ mang tính hiển thị — học sinh có thể tắt
  // tab/sửa client để bỏ qua nó. Chặn ở đây (thời điểm duy nhất còn ghi dữ
  // liệu mới vào bài làm) là nơi thực thi giới hạn thời gian thật sự: quá
  // giờ thì tự nộp/chấm bài ngay (xem finalizeIfExpired) thay vì chỉ chặn,
  // để điểm không bị "treo" chờ học sinh quay lại bấm nộp.
  async saveAnswer(
    attemptId: string,
    user: JwtPayload,
    questionId: string,
    response: unknown,
    timeSpentSeconds?: number,
  ) {
    const attempt = await this.findAttemptOrThrow(attemptId);
    if (attempt.studentId !== user.sub) {
      throw new ForbiddenException('Đây không phải lượt làm bài của bạn');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Lượt làm bài đã kết thúc');
    }
    const exam = await this.prisma.exam.findUnique({
      where: { id: attempt.examId },
      select: { durationMinutes: true },
    });
    const expired = await this.finalizeIfExpired(
      attempt,
      exam?.durationMinutes ?? 0,
    );
    if (expired) {
      throw new BadRequestException(
        'Đã hết thời gian làm bài — hệ thống đã tự động nộp bài, vui lòng xem kết quả',
      );
    }
    // Chặn học sinh lưu câu trả lời cho một questionId không thuộc đề đang
    // thi (vd. sửa request thủ công) — vừa tránh rác dữ liệu, vừa tránh lộ
    // việc một câu hỏi bất kỳ tồn tại trong hệ thống qua cách này.
    const belongsToExam = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: attempt.examId, questionId } },
      select: { questionId: true },
    });
    if (!belongsToExam) {
      throw new BadRequestException('Câu hỏi này không thuộc đề đang thi');
    }
    return this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        response: response as Prisma.InputJsonValue,
        timeSpentSeconds: timeSpentSeconds ?? 0,
      },
      update: {
        response: response as Prisma.InputJsonValue,
        ...(timeSpentSeconds
          ? { timeSpentSeconds: { increment: timeSpentSeconds } }
          : {}),
      },
    });
  }

  async getAttempt(id: string, user: JwtPayload) {
    const include = {
      answers: true,
      exam: { include: { sections: { orderBy: { order: 'asc' as const } } } },
    };
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id },
      include,
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (user.role === Role.STUDENT && attempt.studentId !== user.sub) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }
    const expired = await this.finalizeIfExpired(
      attempt,
      attempt.exam.durationMinutes,
    );
    if (!expired) return attempt;
    return this.prisma.examAttempt.findUniqueOrThrow({
      where: { id },
      include,
    });
  }

  // ADMIN xem toàn bộ lượt làm bài của một đề để theo dõi/thống kê.
  async listAttemptsForExam(examId: string, user: JwtPayload) {
    this.assertAdminOnly(user);
    await this.findExamOrThrow(examId);
    return this.prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        score: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Học sinh xem lại lịch sử làm bài của chính mình (mọi đề) — dùng cho
  // dashboard tiến độ ôn tập cá nhân (điểm theo thời gian, số đề đã làm).
  listMyAttempts(user: JwtPayload) {
    return this.prisma.examAttempt.findMany({
      where: { studentId: user.sub },
      include: {
        exam: { select: { id: true, title: true, category: true } },
        score: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Đáp án đúng, giải thích và câu sai chỉ lộ ra sau khi bài đã được nộp/chấm —
  // không dùng chung với listQuestions() vốn phục vụ lúc học sinh đang làm bài.
  async getAttemptReview(attemptId: string, user: JwtPayload) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: { question: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (user.role === Role.STUDENT && attempt.studentId !== user.sub) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }

    const expired = await this.finalizeIfExpired(
      attempt,
      attempt.exam.durationMinutes,
    );
    let answers = attempt.answers;
    if (expired) {
      answers = await this.prisma.answer.findMany({ where: { attemptId } });
    } else if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Bài làm chưa được nộp, chưa thể xem đáp án',
      );
    }

    // AI chấm và công bố điểm ngay lập tức (kể cả tự luận Văn) — ADMIN vẫn có
    // thể điều chỉnh lại sau qua GradingService.reviewEssay.
    const answersByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
    return attempt.exam.examQuestions.map((eq) => {
      const answer = answersByQuestionId.get(eq.questionId);
      return {
        questionId: eq.questionId,
        sectionId: eq.sectionId,
        answerId: answer?.id ?? null,
        content: eq.question.content,
        type: eq.question.type,
        options: eq.question.options,
        correctAnswer: eq.question.correctAnswer,
        explanation: eq.question.explanation,
        maxScore: eq.maxScore,
        response: answer?.response ?? null,
        isCorrect: answer?.isCorrect ?? null,
        scoreAwarded: answer?.scoreAwarded ?? null,
        aiPreliminaryScore: answer?.aiPreliminaryScore ?? null,
        aiComment: answer?.aiComment ?? null,
        isAiReferenceOnly: answer?.isAiReferenceOnly ?? false,
        aiExplanation: answer?.aiExplanation ?? null,
        needsManualGrading: answer?.needsManualGrading ?? false,
        fallbackReason: answer?.fallbackReason ?? null,
      };
    });
  }
}
