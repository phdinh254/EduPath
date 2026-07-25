import { Injectable } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';
import { GamificationService } from '../gamification/gamification.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Trọng số 4 thành phần tổng hợp thành "Điểm sẵn sàng thi" — cố tình minh
// bạch, không dùng mô hình học máy huấn luyện sẵn (không có dữ liệu điểm thi
// thật để huấn luyện), để có thể giải thích rõ ràng cho học sinh (và trong
// báo cáo đồ án) vì sao điểm cao/thấp.
const WEIGHTS = {
  score: 0.4,
  coverage: 0.25,
  mastery: 0.2,
  consistency: 0.15,
};

// Chỉ xét tối đa 3 lượt làm gần nhất có đụng tới môn này — phản ánh phong độ
// hiện tại, không để một lượt làm rất cũ kéo điểm sai lệch.
const RECENT_ATTEMPTS_WINDOW = 3;

interface TopicBreakdownEntry {
  correct: number;
  total: number;
  subjectId: string;
}

export interface ReadinessResult {
  subjectId: string;
  readinessScore: number;
  breakdown: {
    score: number;
    coverage: number;
    mastery: number;
    consistency: number;
  };
  predictedScoreRange: { low: number; high: number } | null;
  aiNote: string;
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly gamification: GamificationService,
  ) {}

  async getReadinessForSubject(
    studentId: string,
    subjectId: string,
  ): Promise<ReadinessResult> {
    const computed = await this.computeReadiness(studentId, subjectId);
    const aiNote = await this.buildAiNote(
      computed.subjectName,
      computed.readinessScore,
      computed.breakdown,
    );
    return {
      subjectId,
      readinessScore: computed.readinessScore,
      breakdown: computed.breakdown,
      predictedScoreRange: computed.predictedScoreRange,
      aiNote,
    };
  }

  // Chỉ lưu điểm số (không sinh aiNote — tránh gọi Gemini chặn luồng chấm
  // bài) — gọi ngay sau khi một lượt làm bài được chấm xong, mỗi ngày chỉ
  // giữ 1 bản ghi mới nhất cho mỗi (học sinh, môn) nhờ upsert theo dateKey.
  async snapshotReadiness(studentId: string, subjectId: string) {
    const { readinessScore } = await this.computeReadiness(
      studentId,
      subjectId,
    );
    const dateKey = new Date().toISOString().slice(0, 10);
    await this.prisma.readinessSnapshot.upsert({
      where: {
        studentId_subjectId_dateKey: { studentId, subjectId, dateKey },
      },
      create: { studentId, subjectId, dateKey, readinessScore },
      update: { readinessScore },
    });
  }

  getReadinessHistory(studentId: string, subjectId: string, days = 30) {
    const since = new Date(Date.now() - days * ONE_DAY_MS);
    return this.prisma.readinessSnapshot.findMany({
      where: { studentId, subjectId, capturedAt: { gte: since } },
      orderBy: { dateKey: 'asc' },
      select: { dateKey: true, readinessScore: true },
    });
  }

  private async computeReadiness(studentId: string, subjectId: string) {
    const [subject, topicsCount, attempts, latestAnalysis, streak] =
      await Promise.all([
        this.prisma.subject.findUniqueOrThrow({ where: { id: subjectId } }),
        this.prisma.topic.count({ where: { subjectId } }),
        this.prisma.examAttempt.findMany({
          where: { studentId, status: AttemptStatus.GRADED },
          select: {
            submittedAt: true,
            score: { select: { topicBreakdown: true } },
          },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.weaknessAnalysis.findFirst({
          where: { studentId, subjectId },
          orderBy: { generatedAt: 'desc' },
          select: { weakTopics: true },
        }),
        this.gamification.getStreak(studentId),
      ]);

    // Với mỗi lượt làm, chỉ giữ lại phần thuộc đúng môn này (một đề ĐGNL có
    // nhiều môn/section trong cùng một lượt làm) — % đúng riêng của môn đó
    // trong lượt làm, không phải tổng điểm cả đề.
    const touchedTopicIds = new Set<string>();
    const subjectPercentagesDesc: number[] = [];
    let lastTouchedAt: Date | null = null;

    for (const attempt of attempts) {
      const breakdown = (attempt.score?.topicBreakdown ??
        null) as unknown as Record<string, TopicBreakdownEntry> | null;
      if (!breakdown) continue;

      let correctSum = 0;
      let totalSum = 0;
      for (const [topicId, stats] of Object.entries(breakdown)) {
        if (stats.subjectId !== subjectId) continue;
        touchedTopicIds.add(topicId);
        correctSum += stats.correct;
        totalSum += stats.total;
      }
      if (totalSum === 0) continue;

      if (!lastTouchedAt && attempt.submittedAt) {
        lastTouchedAt = attempt.submittedAt;
      }
      if (subjectPercentagesDesc.length < RECENT_ATTEMPTS_WINDOW) {
        subjectPercentagesDesc.push(correctSum / totalSum);
      }
    }

    const scoreComponent =
      subjectPercentagesDesc.length > 0
        ? (subjectPercentagesDesc.reduce((s, p) => s + p, 0) /
            subjectPercentagesDesc.length) *
          100
        : 0;

    const coverageComponent =
      topicsCount > 0
        ? Math.min(100, (touchedTopicIds.size / topicsCount) * 100)
        : 0;

    const weakTopics =
      (latestAnalysis?.weakTopics as unknown as Array<{ topicId: string }>) ??
      [];
    const masteryComponent =
      touchedTopicIds.size > 0
        ? Math.max(0, 100 - (weakTopics.length / touchedTopicIds.size) * 100)
        : 100;

    const daysSinceLastAttempt = lastTouchedAt
      ? (Date.now() - lastTouchedAt.getTime()) / ONE_DAY_MS
      : null;
    const recencyScore =
      daysSinceLastAttempt === null
        ? 0
        : Math.max(0, 100 - daysSinceLastAttempt * 15);
    const consistencyComponent =
      0.7 * recencyScore + 0.3 * Math.min(streak.currentStreak * 20, 100);

    const readinessScore = Math.round(
      WEIGHTS.score * scoreComponent +
        WEIGHTS.coverage * coverageComponent +
        WEIGHTS.mastery * masteryComponent +
        WEIGHTS.consistency * consistencyComponent,
    );

    const predictedScoreRange =
      subjectPercentagesDesc.length > 0
        ? this.buildPredictedRange(readinessScore, subjectPercentagesDesc)
        : null;

    return {
      subjectName: subject.name,
      readinessScore,
      breakdown: {
        score: Math.round(scoreComponent),
        coverage: Math.round(coverageComponent),
        mastery: Math.round(masteryComponent),
        consistency: Math.round(consistencyComponent),
      },
      predictedScoreRange,
    };
  }

  // Học sinh có thể ôn nhiều môn cùng lúc — trả về từng môn đã từng làm bài
  // (không giới hạn THPT hay ĐGNL, vì tính theo topicBreakdown per-subject
  // chứ không theo category của đề) kèm điểm trung bình tổng hợp.
  async getMyReadiness(studentId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { studentId, status: AttemptStatus.GRADED },
      select: { score: { select: { topicBreakdown: true } } },
    });
    const subjectIds = new Set<string>();
    for (const attempt of attempts) {
      const breakdown = (attempt.score?.topicBreakdown ??
        null) as unknown as Record<string, TopicBreakdownEntry> | null;
      if (!breakdown) continue;
      for (const stats of Object.values(breakdown)) {
        subjectIds.add(stats.subjectId);
      }
    }
    if (subjectIds.size === 0) {
      return { overallScore: null, subjects: [] as ReadinessResult[] };
    }

    const subjects = await Promise.all(
      [...subjectIds].map((subjectId) =>
        this.getReadinessForSubject(studentId, subjectId),
      ),
    );
    const overallScore = Math.round(
      subjects.reduce((s, r) => s + r.readinessScore, 0) / subjects.length,
    );
    return { overallScore, subjects };
  }

  // Khoảng điểm dự đoán trên thang 10 (dễ hiểu, quen thuộc với học sinh dù đề
  // là THPT hay ĐGNL) — tâm là readinessScore quy đổi, độ rộng dựa trên độ
  // lệch của các lượt làm gần đây (biến động càng lớn thì càng kém chắc
  // chắn, khoảng dự đoán càng rộng thay vì chốt cứng một con số ảo tưởng).
  private buildPredictedRange(
    readinessScore: number,
    subjectPercentagesDesc: number[],
  ) {
    const center = readinessScore / 10;
    let band = 1.5;
    if (subjectPercentagesDesc.length >= 2) {
      const mean =
        subjectPercentagesDesc.reduce((s, p) => s + p, 0) /
        subjectPercentagesDesc.length;
      const variance =
        subjectPercentagesDesc.reduce((s, p) => s + (p - mean) ** 2, 0) /
        subjectPercentagesDesc.length;
      band = Math.min(2, Math.max(0.3, Math.sqrt(variance) * 10));
    }
    return {
      low: Math.round(Math.max(0, center - band) * 10) / 10,
      high: Math.round(Math.min(10, center + band) * 10) / 10,
    };
  }

  private async buildAiNote(
    subjectName: string,
    readinessScore: number,
    breakdown: {
      score: number;
      coverage: number;
      mastery: number;
      consistency: number;
    },
  ): Promise<string> {
    const weakestLabel = (
      Object.entries(breakdown) as Array<[keyof typeof breakdown, number]>
    ).sort((a, b) => a[1] - b[1])[0][0];
    const weakestNameVi = {
      score: 'điểm số các lần làm gần đây',
      coverage: 'độ phủ chuyên đề (còn nhiều phần chưa luyện tới)',
      mastery: 'mức độ thành thạo (còn chuyên đề yếu)',
      consistency: 'tính đều đặn (lâu chưa ôn tập)',
    }[weakestLabel];

    if (!this.gemini.isConfigured()) {
      return `Điểm sẵn sàng môn ${subjectName}: ${readinessScore}/100. Yếu tố cần cải thiện nhất hiện tại: ${weakestNameVi}.`;
    }
    const prompt = `Bạn là cố vấn học tập AI cho học sinh THPT tại Việt Nam. Học sinh đang có "điểm sẵn sàng thi" môn ${subjectName} là ${readinessScore}/100, ghép từ 4 yếu tố: điểm số gần đây ${Math.round(breakdown.score)}/100, độ phủ chuyên đề ${Math.round(breakdown.coverage)}/100, mức độ thành thạo ${Math.round(breakdown.mastery)}/100, tính đều đặn ôn tập ${Math.round(breakdown.consistency)}/100. Yếu tố thấp nhất là "${weakestNameVi}". Viết 2 câu nhận xét ngắn gọn, thẳng thắn, có tính động viên bằng tiếng Việt, tập trung vào yếu tố cần cải thiện nhất. Chỉ trả về đoạn văn, không dùng JSON.`;
    try {
      return await this.gemini.generateText(prompt);
    } catch {
      return `Điểm sẵn sàng môn ${subjectName}: ${readinessScore}/100. Yếu tố cần cải thiện nhất hiện tại: ${weakestNameVi}.`;
    }
  }
}
