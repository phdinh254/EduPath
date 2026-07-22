import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';

// Ngưỡng tỷ lệ đúng để coi một chuyên đề là "điểm yếu" cần ưu tiên ôn tập.
const WEAK_TOPIC_THRESHOLD = 0.5;

interface TopicBreakdown {
  [topicId: string]: { correct: number; total: number; subjectId: string };
}

interface WeakTopic {
  topicId: string;
  correct: number;
  total: number;
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
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  // Được gọi tự động sau khi một lượt làm bài được chấm xong hoàn toàn (GradingService).
  // Đề ĐGNL gồm nhiều môn trong cùng một lượt làm bài (mỗi section một môn),
  // nên điểm yếu/lộ trình phải nhóm theo subjectId lấy từ từng câu hỏi — không
  // còn dùng attempt.exam.subjectId (chỉ đúng với đề THPT 1 môn/đề).
  async generateForAttempt(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { score: true },
    });
    if (!attempt?.score) return;

    const breakdown = attempt.score.topicBreakdown as unknown as TopicBreakdown;
    const weakTopicsBySubject = new Map<string, WeakTopic[]>();
    for (const [topicId, stats] of Object.entries(breakdown)) {
      if (
        stats.total === 0 ||
        stats.correct / stats.total >= WEAK_TOPIC_THRESHOLD
      ) {
        continue;
      }
      const list = weakTopicsBySubject.get(stats.subjectId) ?? [];
      list.push({ topicId, correct: stats.correct, total: stats.total });
      weakTopicsBySubject.set(stats.subjectId, list);
    }

    // Phân tích điểm yếu ghi nhận theo từng môn xuất hiện trong bài (kể cả khi
    // không có chuyên đề nào yếu — vẫn lưu lại breakdown đầy đủ để tham khảo).
    const subjectIdsInAttempt = new Set(
      Object.values(breakdown).map((s) => s.subjectId),
    );
    for (const subjectId of subjectIdsInAttempt) {
      const weakTopics = weakTopicsBySubject.get(subjectId) ?? [];
      const subjectBreakdown = Object.fromEntries(
        Object.entries(breakdown).filter(([, s]) => s.subjectId === subjectId),
      );
      const weaknessAnalysis = await this.prisma.weaknessAnalysis.create({
        data: {
          studentId: attempt.studentId,
          subjectId,
          attemptId: attempt.id,
          weakTopics: weakTopics as unknown as Prisma.InputJsonValue,
          details: {
            topicBreakdown: subjectBreakdown,
          },
        },
      });
      if (weakTopics.length > 0) {
        await this.upsertRoadmap(attempt.studentId, subjectId, weakTopics);
        if (this.gemini.isConfigured()) {
          // Fire-and-forget: không chặn việc chấm điểm/tạo lộ trình (vốn phải
          // tức thời) — lời khuyên AI sẽ xuất hiện sau vài giây khi học sinh
          // xem lại trang lộ trình.
          this.generateAdviceInBackground(
            weaknessAnalysis.id,
            weakTopics,
          ).catch((err: unknown) =>
            this.logger.warn(
              `Không sinh được lời khuyên AI cho weaknessAnalysis ${weaknessAnalysis.id}: ${String(err)}`,
            ),
          );
        }
      }
    }
  }

  private async generateAdviceInBackground(
    weaknessAnalysisId: string,
    weakTopics: WeakTopic[],
  ) {
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: weakTopics.map((wt) => wt.topicId) } },
    });
    const topicNameById = new Map(topics.map((t) => [t.id, t.name]));

    const adviceByTopic: Record<string, string> = {};
    for (const wt of weakTopics) {
      const topicName = topicNameById.get(wt.topicId) ?? wt.topicId;
      const prompt = `Bạn là gia sư luyện thi THPT tại Việt Nam. Học sinh làm đúng ${wt.correct}/${wt.total} câu ở chuyên đề "${topicName}" — đây là chuyên đề yếu cần ưu tiên ôn tập. Hãy viết 2-3 câu lời khuyên cụ thể, thực tế bằng tiếng Việt giúp học sinh cải thiện chuyên đề này (nên ôn lại phần nào, luyện dạng bài gì). Chỉ trả về đoạn văn lời khuyên, không dùng JSON, không nhắc lại số liệu đã cho.`;
      try {
        adviceByTopic[wt.topicId] = await this.gemini.generateText(prompt);
      } catch {
        // Bỏ qua chuyên đề bị lỗi, không để một lời gọi hỏng chặn các chuyên đề còn lại.
      }
    }
    if (Object.keys(adviceByTopic).length === 0) return;

    const record = await this.prisma.weaknessAnalysis.findUnique({
      where: { id: weaknessAnalysisId },
    });
    if (!record) return;
    const details = (record.details as Record<string, unknown> | null) ?? {};
    await this.prisma.weaknessAnalysis.update({
      where: { id: weaknessAnalysisId },
      data: { details: { ...details, adviceByTopic } },
    });
  }

  private async upsertRoadmap(
    studentId: string,
    subjectId: string,
    weakTopics: WeakTopic[],
  ) {
    const existing = await this.prisma.studyRoadmap.findFirst({
      where: { studentId, subjectId, status: RoadmapStatus.ACTIVE },
    });

    // Giữ lại trạng thái (vd. COMPLETED) của các giai đoạn đã có từ lần phân
    // tích trước — chỉ topic/giai đoạn còn yếu mới xuất hiện lại, nhưng không
    // được reset về PENDING nếu học sinh đã hoàn thành trước đó.
    const previousStages =
      (existing?.stages as
        | Array<{
            topicId: string;
            stage: string;
            status: string;
          }>
        | undefined) ?? [];
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
        data: { studentId, subjectId, stages },
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
