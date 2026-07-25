import { Injectable } from '@nestjs/common';
import { AttemptStatus, ExamCategory, RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Thang điểm tối đa theo loại đề — dùng để xét huy hiệu "điểm cao" trên cùng
// một mốc %, giống cách StudentRoadmapPage chuẩn hoá điểm THPT/ĐGNL.
const MAX_SCORE_BY_CATEGORY: Record<ExamCategory, number> = {
  THPT: 10,
  DGNL: 150,
};
const HIGH_SCORE_PERCENT = 0.8;

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
}

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  check: (stats: {
    totalAttempts: number;
    longestStreak: number;
    completedRoadmaps: number;
    hasHighScore: boolean;
  }) => boolean;
}

// Không lưu bảng Badge riêng — huy hiệu tính lại mỗi lần gọi từ dữ liệu hiện
// có (ExamAttempt, StudyRoadmap), cùng triết lý "lazy" với NotificationsService.
// Điều kiện đều là cột mốc tích luỹ (không thể bị mất đi), nên tính lại luôn
// cho kết quả nhất quán mà không cần theo dõi thời điểm đạt được.
const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_attempt',
    name: 'Khởi động',
    description: 'Hoàn thành đề đầu tiên',
    check: (s) => s.totalAttempts >= 1,
  },
  {
    id: 'five_attempts',
    name: 'Chăm chỉ',
    description: 'Hoàn thành 5 đề',
    check: (s) => s.totalAttempts >= 5,
  },
  {
    id: 'twenty_attempts',
    name: 'Bền bỉ',
    description: 'Hoàn thành 20 đề',
    check: (s) => s.totalAttempts >= 20,
  },
  {
    id: 'streak_3',
    name: 'Chuỗi 3 ngày',
    description: 'Ôn tập 3 ngày liên tiếp',
    check: (s) => s.longestStreak >= 3,
  },
  {
    id: 'streak_7',
    name: 'Chuỗi 7 ngày',
    description: 'Ôn tập 7 ngày liên tiếp',
    check: (s) => s.longestStreak >= 7,
  },
  {
    id: 'roadmap_complete',
    name: 'Chinh phục lộ trình',
    description: 'Hoàn thành trọn vẹn 1 lộ trình ôn tập AI',
    check: (s) => s.completedRoadmaps >= 1,
  },
  {
    id: 'high_score',
    name: 'Điểm cao',
    description: `Đạt từ ${HIGH_SCORE_PERCENT * 100}% điểm tối đa trở lên trong một đề`,
    check: (s) => s.hasHighScore,
  },
];

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  private toDateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  async getStreak(studentId: string): Promise<StreakInfo> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        studentId,
        status: AttemptStatus.GRADED,
        submittedAt: { not: null },
      },
      select: { submittedAt: true },
    });

    const dayKeysDesc = [
      ...new Set(attempts.map((a) => this.toDateKey(a.submittedAt!))),
    ].sort((a, b) => (a < b ? 1 : -1));

    if (dayKeysDesc.length === 0) {
      return { currentStreak: 0, longestStreak: 0, isActiveToday: false };
    }

    const todayKey = this.toDateKey(new Date());
    const yesterdayKey = this.toDateKey(new Date(Date.now() - ONE_DAY_MS));

    // Chuỗi hiện tại: chỉ còn "sống" nếu lần ôn gần nhất là hôm nay hoặc hôm
    // qua (chưa đứt) — sau đó đếm ngược các ngày liên tiếp trước đó.
    let currentStreak = 0;
    if (dayKeysDesc[0] === todayKey || dayKeysDesc[0] === yesterdayKey) {
      let cursor = new Date(`${dayKeysDesc[0]}T00:00:00.000Z`);
      for (const key of dayKeysDesc) {
        if (this.toDateKey(cursor) === key) {
          currentStreak++;
          cursor = new Date(cursor.getTime() - ONE_DAY_MS);
        } else {
          break;
        }
      }
    }

    // Chuỗi dài nhất từng đạt được: quét các ngày theo thứ tự tăng dần, đếm
    // đoạn liên tiếp dài nhất.
    const dayKeysAsc = [...dayKeysDesc].reverse();
    let longestStreak = 1;
    let run = 1;
    for (let i = 1; i < dayKeysAsc.length; i++) {
      const prev = new Date(`${dayKeysAsc[i - 1]}T00:00:00.000Z`);
      const curr = new Date(`${dayKeysAsc[i]}T00:00:00.000Z`);
      run = curr.getTime() - prev.getTime() === ONE_DAY_MS ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
    }

    return {
      currentStreak,
      longestStreak,
      isActiveToday: dayKeysDesc[0] === todayKey,
    };
  }

  async getBadges(studentId: string) {
    const [gradedAttempts, completedRoadmapsCount, streak] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where: { studentId, status: AttemptStatus.GRADED },
        select: { totalScore: true, exam: { select: { category: true } } },
      }),
      this.prisma.studyRoadmap.count({
        where: { studentId, status: RoadmapStatus.COMPLETED },
      }),
      this.getStreak(studentId),
    ]);

    const hasHighScore = gradedAttempts.some((a) => {
      if (a.totalScore == null) return false;
      const maxScore = MAX_SCORE_BY_CATEGORY[a.exam.category];
      return a.totalScore / maxScore >= HIGH_SCORE_PERCENT;
    });

    const stats = {
      totalAttempts: gradedAttempts.length,
      longestStreak: streak.longestStreak,
      completedRoadmaps: completedRoadmapsCount,
      hasHighScore,
    };

    return BADGE_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      earned: def.check(stats),
    }));
  }
}
