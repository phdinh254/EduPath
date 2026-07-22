import { Injectable } from '@nestjs/common';
import { ContentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  findAuditLogs(skip = 0, take = 50) {
    return this.prisma.auditLog.findMany({
      skip,
      take,
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
