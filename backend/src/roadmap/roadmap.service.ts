import { Injectable } from '@nestjs/common';
import { RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Ngưỡng tỷ lệ đúng để coi một chuyên đề là "điểm yếu" cần ưu tiên ôn tập.
const WEAK_TOPIC_THRESHOLD = 0.5;

interface TopicBreakdown {
  [topicId: string]: { correct: number; total: number };
}

// Các giai đoạn ôn tập theo từng chuyên đề yếu — quy tắc rule-based cho MVP,
// sẽ được thay bằng lời gọi LLM API thật khi tích hợp AI đề xuất nội dung học.
const ROADMAP_STAGES = [
  'REVIEW_THEORY',
  'BASIC_PRACTICE',
  'ADVANCED_PRACTICE',
  'RETEST',
] as const;

@Injectable()
export class RoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  // Được gọi tự động sau khi một lượt làm bài được chấm xong hoàn toàn (GradingService).
  async generateForAttempt(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true, score: true },
    });
    if (!attempt?.score) return;

    const breakdown = attempt.score.topicBreakdown as unknown as TopicBreakdown;
    const weakTopics = Object.entries(breakdown)
      .filter(
        ([, stats]) =>
          stats.total > 0 && stats.correct / stats.total < WEAK_TOPIC_THRESHOLD,
      )
      .map(([topicId, stats]) => ({
        topicId,
        correct: stats.correct,
        total: stats.total,
      }));

    await this.prisma.weaknessAnalysis.create({
      data: {
        studentId: attempt.studentId,
        subjectId: attempt.exam.subjectId,
        attemptId: attempt.id,
        weakTopics,
        details: { topicBreakdown: breakdown },
      },
    });

    if (weakTopics.length === 0) return;

    const existing = await this.prisma.studyRoadmap.findFirst({
      where: {
        studentId: attempt.studentId,
        subjectId: attempt.exam.subjectId,
        status: RoadmapStatus.ACTIVE,
      },
    });

    // Giữ lại trạng thái (vd. COMPLETED) của các giai đoạn đã có từ lần phân
    // tích trước — chỉ topic/giai đoạn còn yếu mới xuất hiện lại, nhưng không
    // được reset về PENDING nếu học sinh đã hoàn thành trước đó.
    const previousStages =
      ((existing?.stages ?? []) as Array<{
        topicId: string;
        stage: string;
        status: string;
      }>) ?? [];
    const previousByKey = new Map(
      previousStages.map((s) => [`${s.topicId}:${s.stage}`, s]),
    );
    const stages = weakTopics.flatMap((wt) =>
      ROADMAP_STAGES.map((stage) => {
        const key = `${wt.topicId}:${stage}`;
        return (
          previousByKey.get(key) ?? {
            topicId: wt.topicId,
            stage,
            status: 'PENDING',
          }
        );
      }),
    );

    if (existing) {
      await this.prisma.studyRoadmap.update({
        where: { id: existing.id },
        data: { stages },
      });
    } else {
      await this.prisma.studyRoadmap.create({
        data: {
          studentId: attempt.studentId,
          subjectId: attempt.exam.subjectId,
          stages,
        },
      });
    }
  }

  findWeaknessesForStudent(studentId: string, subjectId?: string) {
    return this.prisma.weaknessAnalysis.findMany({
      where: { studentId, subjectId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  findRoadmapForStudent(studentId: string, subjectId?: string) {
    return this.prisma.studyRoadmap.findMany({
      where: { studentId, subjectId, status: RoadmapStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
