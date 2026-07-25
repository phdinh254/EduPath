import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';

// Ngưỡng tỷ lệ đúng để coi một chuyên đề là "điểm yếu" cần ưu tiên ôn tập.
const WEAK_TOPIC_THRESHOLD = 0.5;

interface TopicBreakdown {
  [topicId: string]: {
    correct: number;
    total: number;
    subjectId: string;
    timeSpentSeconds: number;
    byType: Record<string, { correct: number; total: number }>;
  };
}

interface WeakTopic {
  topicId: string;
  correct: number;
  total: number;
  timeSpentSeconds: number;
  byType: Record<string, { correct: number; total: number }>;
  // Số lượt phân tích gần đây (tính cả lần này) mà chuyên đề này liên tục
  // yếu — dùng để ưu tiên lời khuyên AI và cảnh báo "yếu kéo dài" ở frontend.
  persistentCount: number;
}

// Số lượt phân tích gần nhất (không tính lượt hiện tại) được xem xét để phát
// hiện điểm yếu kéo dài qua nhiều lần làm bài, đúng theo yêu cầu nghiệp vụ
// "lịch sử nhiều lần kiểm tra" thay vì chỉ nhìn lượt vừa nộp.
const HISTORY_WINDOW = 3;

// Các giai đoạn ôn tập theo từng chuyên đề yếu — quy tắc rule-based cho MVP,
// sẽ được thay bằng lời gọi LLM API thật khi tích hợp AI đề xuất nội dung học.
export const ROADMAP_STAGES = [
  'REVIEW_THEORY',
  'BASIC_PRACTICE',
  'ADVANCED_PRACTICE',
  'RETEST',
] as const;

export type RoadmapStage = (typeof ROADMAP_STAGES)[number];

interface StageEntry {
  topicId: string;
  stage: RoadmapStage;
  status: 'PENDING' | 'COMPLETED';
}

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
    const weakTopicsBySubject = new Map<
      string,
      Array<Omit<WeakTopic, 'persistentCount'>>
    >();
    for (const [topicId, stats] of Object.entries(breakdown)) {
      if (
        stats.total === 0 ||
        stats.correct / stats.total >= WEAK_TOPIC_THRESHOLD
      ) {
        continue;
      }
      const list = weakTopicsBySubject.get(stats.subjectId) ?? [];
      list.push({
        topicId,
        correct: stats.correct,
        total: stats.total,
        timeSpentSeconds: stats.timeSpentSeconds ?? 0,
        byType: stats.byType ?? {},
      });
      weakTopicsBySubject.set(stats.subjectId, list);
    }

    // Phân tích điểm yếu ghi nhận theo từng môn xuất hiện trong bài (kể cả khi
    // không có chuyên đề nào yếu — vẫn lưu lại breakdown đầy đủ để tham khảo).
    const subjectIdsInAttempt = new Set(
      Object.values(breakdown).map((s) => s.subjectId),
    );
    for (const subjectId of subjectIdsInAttempt) {
      const currentWeakTopics = weakTopicsBySubject.get(subjectId) ?? [];
      const weakTopics = await this.withPersistentCount(
        attempt.studentId,
        subjectId,
        currentWeakTopics,
      );
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

      // Chuyên đề từng nằm trong lộ trình nhưng lần này không còn yếu nữa —
      // coi như học sinh đã tự "kiểm tra lại" thành công, tự đóng các giai
      // đoạn còn lại của chuyên đề đó thay vì bắt học sinh tự tay đánh dấu.
      await this.autoCompleteImprovedStages(
        attempt.studentId,
        subjectId,
        new Set(Object.keys(subjectBreakdown)),
        new Set(weakTopics.map((wt) => wt.topicId)),
      );
    }
  }

  private async autoCompleteImprovedStages(
    studentId: string,
    subjectId: string,
    topicIdsInAttempt: Set<string>,
    stillWeakTopicIds: Set<string>,
  ) {
    const roadmap = await this.prisma.studyRoadmap.findFirst({
      where: { studentId, subjectId, status: RoadmapStatus.ACTIVE },
    });
    if (!roadmap) return;

    const stages = roadmap.stages as unknown as StageEntry[];
    let changed = false;
    for (const stage of stages) {
      if (
        topicIdsInAttempt.has(stage.topicId) &&
        !stillWeakTopicIds.has(stage.topicId) &&
        stage.status !== 'COMPLETED'
      ) {
        stage.status = 'COMPLETED';
        changed = true;
      }
    }
    if (!changed) return;

    const allDone = stages.every((s) => s.status === 'COMPLETED');
    await this.prisma.studyRoadmap.update({
      where: { id: roadmap.id },
      data: {
        stages: stages as unknown as Prisma.InputJsonValue,
        status: allDone ? RoadmapStatus.COMPLETED : RoadmapStatus.ACTIVE,
      },
    });
  }

  // Học sinh tự đánh dấu đã hoàn thành một giai đoạn ôn tập (vd. đã ôn xong lý
  // thuyết, đã luyện xong bài cơ bản) — chỉ cho phép đánh dấu theo đúng thứ tự
  // (không được nhảy cóc qua giai đoạn chưa hoàn thành trước đó) để lộ trình
  // phản ánh đúng tiến độ thực tế.
  async completeStage(
    studentId: string,
    roadmapId: string,
    topicId: string,
    stage: RoadmapStage,
  ) {
    const roadmap = await this.prisma.studyRoadmap.findUnique({
      where: { id: roadmapId },
    });
    if (!roadmap) {
      throw new NotFoundException('Không tìm thấy lộ trình');
    }
    if (roadmap.studentId !== studentId) {
      throw new ForbiddenException('Đây không phải lộ trình của bạn');
    }
    if (roadmap.status !== RoadmapStatus.ACTIVE) {
      throw new BadRequestException('Lộ trình này đã đóng');
    }

    const stages = roadmap.stages as unknown as StageEntry[];
    const stageIndex = ROADMAP_STAGES.indexOf(stage);
    if (stageIndex === -1) {
      throw new BadRequestException('Giai đoạn không hợp lệ');
    }
    for (let i = 0; i < stageIndex; i++) {
      const prevStage = stages.find(
        (s) => s.topicId === topicId && s.stage === ROADMAP_STAGES[i],
      );
      if (prevStage && prevStage.status !== 'COMPLETED') {
        throw new BadRequestException(
          `Cần hoàn thành giai đoạn "${ROADMAP_STAGES[i]}" trước`,
        );
      }
    }
    const target = stages.find(
      (s) => s.topicId === topicId && s.stage === stage,
    );
    if (!target) {
      throw new NotFoundException(
        'Không tìm thấy giai đoạn này trong lộ trình',
      );
    }
    target.status = 'COMPLETED';

    const allDone = stages.every((s) => s.status === 'COMPLETED');
    return this.prisma.studyRoadmap.update({
      where: { id: roadmapId },
      data: {
        stages: stages as unknown as Prisma.InputJsonValue,
        status: allDone ? RoadmapStatus.COMPLETED : RoadmapStatus.ACTIVE,
      },
    });
  }

  // Nhìn lại tối đa HISTORY_WINDOW lượt phân tích gần nhất (không tính lượt
  // hiện tại) của cùng học sinh/môn để tính số lần liên tiếp một chuyên đề
  // xuất hiện là điểm yếu — đúng yêu cầu nghiệp vụ dựa vào "lịch sử nhiều lần
  // kiểm tra", không chỉ một lượt làm bài đơn lẻ.
  private async withPersistentCount(
    studentId: string,
    subjectId: string,
    currentWeakTopics: Array<Omit<WeakTopic, 'persistentCount'>>,
  ): Promise<WeakTopic[]> {
    if (currentWeakTopics.length === 0) return [];

    const pastAnalyses = await this.prisma.weaknessAnalysis.findMany({
      where: { studentId, subjectId },
      orderBy: { generatedAt: 'desc' },
      take: HISTORY_WINDOW,
      select: { weakTopics: true },
    });
    const pastWeakTopicIdSets = pastAnalyses.map(
      (a) =>
        new Set(
          (a.weakTopics as unknown as Array<{ topicId: string }>).map(
            (wt) => wt.topicId,
          ),
        ),
    );

    return currentWeakTopics.map((wt) => ({
      ...wt,
      persistentCount:
        1 + pastWeakTopicIdSets.filter((s) => s.has(wt.topicId)).length,
    }));
  }

  private async generateAdviceInBackground(
    weaknessAnalysisId: string,
    weakTopics: WeakTopic[],
  ) {
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: weakTopics.map((wt) => wt.topicId) } },
    });
    const topicNameById = new Map(topics.map((t) => [t.id, t.name]));

    // Ưu tiên sinh lời khuyên cho chuyên đề yếu kéo dài lâu nhất trước — nếu
    // Gemini gặp lỗi giữa chừng, các chuyên đề quan trọng nhất vẫn có lời khuyên.
    const sortedWeakTopics = [...weakTopics].sort(
      (a, b) => b.persistentCount - a.persistentCount,
    );

    const adviceByTopic: Record<string, string> = {};
    for (const wt of sortedWeakTopics) {
      const topicName = topicNameById.get(wt.topicId) ?? wt.topicId;
      const avgSeconds =
        wt.total > 0 ? Math.round(wt.timeSpentSeconds / wt.total) : 0;
      const persistentNote =
        wt.persistentCount > 1
          ? ` Đây là chuyên đề học sinh làm yếu liên tục ${wt.persistentCount} lần kiểm tra gần đây, cần ưu tiên ôn tập ngay.`
          : '';
      const timeNote =
        avgSeconds > 0
          ? ` Trung bình mất khoảng ${avgSeconds} giây/câu ở chuyên đề này.`
          : '';
      const prompt = `Bạn là gia sư luyện thi THPT tại Việt Nam. Học sinh làm đúng ${wt.correct}/${wt.total} câu ở chuyên đề "${topicName}" — đây là chuyên đề yếu cần ưu tiên ôn tập.${persistentNote}${timeNote} Hãy viết 2-3 câu lời khuyên cụ thể, thực tế bằng tiếng Việt giúp học sinh cải thiện chuyên đề này (nên ôn lại phần nào, luyện dạng bài gì, có cần luyện tốc độ làm bài không). Chỉ trả về đoạn văn lời khuyên, không dùng JSON, không nhắc lại số liệu đã cho.`;
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
