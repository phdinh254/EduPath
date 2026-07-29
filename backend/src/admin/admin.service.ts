import { Injectable } from '@nestjs/common';
import { ContentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toPaginatedResult, toSkipTake } from '../common/pagination.util';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalStudents,
      totalSubjects,
      totalExams,
      totalAttempts,
      pendingQuestions,
      approvedQuestions,
      rejectedQuestions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.subject.count(),
      this.prisma.exam.count(),
      this.prisma.examAttempt.count(),
      this.prisma.question.count({
        where: { status: ContentStatus.PENDING_APPROVAL },
      }),
      this.prisma.question.count({ where: { status: ContentStatus.APPROVED } }),
      this.prisma.question.count({ where: { status: ContentStatus.REJECTED } }),
    ]);

    return {
      totalStudents,
      totalSubjects,
      totalExams,
      totalAttempts,
      questionsByStatus: {
        pendingApproval: pendingQuestions,
        approved: approvedQuestions,
        rejected: rejectedQuestions,
      },
    };
  }

  async findAuditLogs(page?: number, limit?: number) {
    const {
      skip,
      take,
      page: safePage,
      limit: safeLimit,
    } = toSkipTake(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return toPaginatedResult(data, total, safePage, safeLimit);
  }
}
