import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpsertExamStructureDto } from './dto/upsert-exam-structure.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.subject.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    return subject;
  }

  create(dto: CreateSubjectDto) {
    return this.prisma.subject.create({ data: dto });
  }

  findTopics(subjectId: string) {
    return this.prisma.topic.findMany({
      where: { subjectId },
      orderBy: { name: 'asc' },
    });
  }

  async createTopic(subjectId: string, dto: CreateTopicDto) {
    await this.findOne(subjectId);
    return this.prisma.topic.create({
      data: { subjectId, name: dto.name, parentTopicId: dto.parentTopicId },
    });
  }

  async getExamStructure(subjectId: string) {
    await this.findOne(subjectId);
    return this.prisma.examStructure.findUnique({
      where: { subjectId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  }

  // Thay thế toàn bộ cấu trúc cũ (nếu có) bằng danh sách item mới — mỗi môn
  // chỉ giữ đúng 1 cấu trúc đề tại một thời điểm, áp dụng cho mọi lần AI ghép
  // đề sau đó (xem ExamsService.generateThptExam).
  async upsertExamStructure(subjectId: string, dto: UpsertExamStructureDto) {
    await this.findOne(subjectId);
    // Đề THPT luôn theo thang điểm 10 (trừ môn chỉ có tự luận, nơi 1 câu ESSAY
    // có thể tự chiếm trọn 10 điểm) — chặn admin cấu hình sai khiến mọi đề
    // ghép tự động sau này lệch thang điểm mà không có cảnh báo nào.
    const totalScore = dto.items.reduce(
      (sum, item) => sum + item.questionCount * item.maxScorePerQuestion,
      0,
    );
    if (Math.abs(totalScore - 10) > 0.01) {
      throw new BadRequestException(
        `Tổng điểm cấu trúc đề phải bằng 10 (hiện tại: ${totalScore})`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.examStructure.deleteMany({ where: { subjectId } });
      return tx.examStructure.create({
        data: {
          subjectId,
          durationMinutes: dto.durationMinutes,
          items: {
            create: dto.items.map((item, i) => ({
              type: item.type,
              difficulty: item.difficulty,
              questionCount: item.questionCount,
              maxScorePerQuestion: item.maxScorePerQuestion,
              order: i + 1,
            })),
          },
        },
        include: { items: { orderBy: { order: 'asc' } } },
      });
    });
  }
}
