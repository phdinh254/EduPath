import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma, QuestionType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateQuestionDto } from './dto/create-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: JwtPayload, dto: CreateQuestionDto) {
    const isAdmin = user.role === Role.ADMIN;
    if (!isAdmin && !user.tenantId) {
      throw new ForbiddenException('Giáo viên chưa có tenant');
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
    }
    return this.prisma.question.create({
      data: {
        ...dto,
        options: dto.options as Prisma.InputJsonValue,
        correctAnswer: dto.correctAnswer as Prisma.InputJsonValue,
        createdById: user.sub,
        tenantId: isAdmin ? null : user.tenantId,
        isGlobal: isAdmin,
        status: isAdmin ? ContentStatus.APPROVED : ContentStatus.DRAFT,
      },
    });
  }

  findAll(user: JwtPayload, status?: ContentStatus) {
    if (user.role === Role.ADMIN) {
      return this.prisma.question.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
      });
    }
    // Giáo viên: câu hỏi thuộc tenant của mình + câu hỏi đã vào kho dùng chung
    return this.prisma.question.findMany({
      where: {
        OR: [
          { tenantId: user.tenantId },
          { isGlobal: true, status: ContentStatus.APPROVED },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    const canView =
      user.role === Role.ADMIN ||
      question.tenantId === user.tenantId ||
      (question.isGlobal && question.status === ContentStatus.APPROVED);
    if (!canView) {
      throw new ForbiddenException('Bạn không có quyền xem câu hỏi này');
    }
    return question;
  }

  private async assertTeacherOwnsDraft(id: string, user: JwtPayload) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (question.tenantId !== user.tenantId) {
      throw new ForbiddenException('Bạn không có quyền thao tác câu hỏi này');
    }
    return question;
  }

  async proposeForGlobal(id: string, user: JwtPayload) {
    const question = await this.assertTeacherOwnsDraft(id, user);
    if (question.status !== ContentStatus.DRAFT) {
      throw new BadRequestException(
        'Chỉ có thể đề xuất câu hỏi đang ở trạng thái nháp',
      );
    }
    return this.prisma.question.update({
      where: { id },
      // Xoá lý do reject cũ (nếu có, từ lần đề xuất trước) để tránh hiển thị nhầm.
      data: { status: ContentStatus.PENDING_APPROVAL, rejectReason: null },
    });
  }

  async approve(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (question.status !== ContentStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Câu hỏi chưa được đề xuất phê duyệt');
    }
    return this.prisma.question.update({
      where: { id },
      data: { status: ContentStatus.APPROVED, isGlobal: true, tenantId: null },
    });
  }

  async reject(id: string, adminId: string, reason?: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (question.status !== ContentStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Câu hỏi chưa được đề xuất phê duyệt');
    }
    const updated = await this.prisma.question.update({
      where: { id },
      data: { status: ContentStatus.REJECTED, rejectReason: reason ?? null },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REJECT_QUESTION',
        entityType: 'Question',
        entityId: id,
        metadata: reason ? { reason } : undefined,
      },
    });
    return updated;
  }
}
