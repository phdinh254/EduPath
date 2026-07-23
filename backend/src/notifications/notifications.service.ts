import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// Không cần cron/bảng Notification riêng: mọi thông báo được tính tại chỗ từ
// dữ liệu đã có (WeaknessAnalysis, ExamAttempt) mỗi lần học sinh mở trang —
// cùng triết lý "lazy" đã dùng cho việc tự động chấm bài quá hạn.
const REMINDER_AFTER_DAYS = 7;

export interface StudentNotification {
  id: string;
  type: 'NEW_ADVICE' | 'REMINDER';
  message: string;
  createdAt: Date;
  subjectId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyNotifications(user: JwtPayload) {
    const student = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      select: { lastNotificationsReadAt: true },
    });
    const since = student.lastNotificationsReadAt ?? new Date(0);

    const [recentAnalyses, latestGradedAttempt] = await Promise.all([
      this.prisma.weaknessAnalysis.findMany({
        where: { studentId: user.sub, generatedAt: { gt: since } },
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.examAttempt.findFirst({
        where: { studentId: user.sub, status: 'GRADED' },
        orderBy: { submittedAt: 'desc' },
        select: { submittedAt: true },
      }),
    ]);

    // Chỉ lấy lần phân tích mới nhất cho mỗi môn — nhiều lượt làm bài liên
    // tiếp cùng môn không nên spam nhiều thông báo giống nhau.
    const seenSubjects = new Set<string>();
    const relevantAnalyses = recentAnalyses.filter((analysis) => {
      if (seenSubjects.has(analysis.subjectId)) return false;
      seenSubjects.add(analysis.subjectId);
      const weakTopics = analysis.weakTopics as unknown[];
      return Array.isArray(weakTopics) && weakTopics.length > 0;
    });
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: relevantAnalyses.map((a) => a.subjectId) } },
      select: { id: true, name: true },
    });
    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

    const notifications: StudentNotification[] = relevantAnalyses.map(
      (analysis) => ({
        id: `advice-${analysis.id}`,
        type: 'NEW_ADVICE',
        message: `Có lời khuyên ôn tập AI mới cho môn ${subjectNameById.get(analysis.subjectId) ?? 'học'}`,
        createdAt: analysis.generatedAt,
        subjectId: analysis.subjectId,
      }),
    );

    const lastActivity = latestGradedAttempt?.submittedAt ?? null;
    const daysSinceLastActivity = lastActivity
      ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      : null;
    if (
      daysSinceLastActivity === null ||
      daysSinceLastActivity >= REMINDER_AFTER_DAYS
    ) {
      notifications.push({
        id: 'reminder-inactivity',
        type: 'REMINDER',
        message:
          lastActivity && daysSinceLastActivity !== null
            ? `Bạn chưa ôn tập trong ${Math.floor(daysSinceLastActivity)} ngày — làm một đề để giữ phong độ nhé!`
            : 'Hãy làm bài thi đầu tiên để AI bắt đầu phân tích và đưa ra lộ trình ôn tập cho bạn.',
        createdAt: lastActivity ?? new Date(),
      });
    }

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { notifications, unreadCount: notifications.length };
  }

  async markAllRead(user: JwtPayload) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { lastNotificationsReadAt: new Date() },
    });
    return { ok: true };
  }
}
