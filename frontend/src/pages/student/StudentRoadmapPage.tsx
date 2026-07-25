import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { completeRoadmapStage, fetchMyRoadmap, fetchMyWeaknesses } from '../../features/roadmap/roadmapApi';
import { fetchMyAttempts, generateTopicPractice } from '../../features/exams/examsApi';
import { fetchMyBadges } from '../../features/gamification/gamificationApi';
import { fetchSubjects, fetchTopics } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Button, Card, PageHeader } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import {
  AwardIcon,
  CheckCircleIcon,
  ChartIcon,
  ClipboardCheckIcon,
  RouteIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
} from '../../components/ui/Icons';
import type { ExamCategory, StudyRoadmap, StudyRoadmapStage } from '../../types/api';

const STAGE_LABEL: Record<string, string> = {
  REVIEW_THEORY: 'Ôn lý thuyết nền tảng',
  BASIC_PRACTICE: 'Làm bài cơ bản',
  ADVANCED_PRACTICE: 'Luyện bài vận dụng',
  RETEST: 'Kiểm tra lại',
};

// Thang điểm tối đa theo loại đề — dùng để chuẩn hoá điểm THPT (10) và ĐGNL
// (150) về cùng thang % khi vẽ chung một biểu đồ xu hướng.
const MAX_SCORE_BY_CATEGORY: Record<ExamCategory, number> = { THPT: 10, DGNL: 150 };

function ProgressDashboard() {
  const attemptsQuery = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts });

  const gradedAttempts = useMemo(
    () =>
      (attemptsQuery.data ?? [])
        .filter((a) => a.status === 'GRADED' && a.totalScore != null && a.exam)
        .map((a, i) => {
          const maxScore = MAX_SCORE_BY_CATEGORY[a.exam!.category];
          const percent = Math.round(((a.totalScore ?? 0) / maxScore) * 1000) / 10;
          return {
            index: i + 1,
            title: a.exam!.title,
            percent,
            date: new Date(a.submittedAt ?? a.createdAt).toLocaleDateString('vi-VN'),
          };
        }),
    [attemptsQuery.data],
  );

  if (attemptsQuery.isLoading) return <LoadingState label="Đang tải tiến độ ôn tập..." />;
  if (attemptsQuery.error) return <ErrorState message={getApiErrorMessage(attemptsQuery.error)} />;
  if (gradedAttempts.length === 0) return null;

  const avgPercent = Math.round((gradedAttempts.reduce((s, a) => s + a.percent, 0) / gradedAttempts.length) * 10) / 10;
  const last = gradedAttempts[gradedAttempts.length - 1];
  const prev = gradedAttempts.length > 1 ? gradedAttempts[gradedAttempts.length - 2] : null;
  const trend = prev ? Math.round((last.percent - prev.percent) * 10) / 10 : null;

  return (
    <div className="mb-10">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Đề đã làm" value={gradedAttempts.length} icon={<ClipboardCheckIcon className="h-6 w-6" />} accent="indigo" />
        <StatCard label="Điểm trung bình" value={`${avgPercent}%`} icon={<ChartIcon className="h-6 w-6" />} accent="emerald" />
        <StatCard
          label="So với lần trước"
          value={trend == null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
          icon={<StarIcon className="h-6 w-6" />}
          accent={trend == null || trend >= 0 ? 'sky' : 'red'}
        />
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Xu hướng điểm số theo thời gian</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gradedAttempts} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis dataKey="index" tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500" />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-slate-500"
                unit="%"
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(value) => [`${value}%`, 'Điểm']}
                labelFormatter={(index) => gradedAttempts[Number(index) - 1]?.title ?? ''}
              />
              <Line type="monotone" dataKey="percent" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function BadgesGrid() {
  const badgesQuery = useQuery({ queryKey: ['my-badges'], queryFn: fetchMyBadges });
  if (!badgesQuery.data || badgesQuery.data.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        <AwardIcon className="h-5 w-5 text-indigo-500" />
        Huy hiệu
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {badgesQuery.data.map((badge) => (
          <Card
            key={badge.id}
            className={`p-4 text-center transition ${badge.earned ? '' : 'opacity-40 grayscale'}`}
          >
            <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-lg">
              🏅
            </span>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{badge.name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{badge.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Nhóm các giai đoạn theo chuyên đề, tìm giai đoạn hiện tại (giai đoạn PENDING
// đầu tiên theo đúng thứ tự) để làm nổi bật và gắn hành động (luyện ngay/đánh
// dấu hoàn thành) — thay vì chỉ hiển thị danh sách tĩnh như trước.
function RoadmapCard({
  roadmap,
  subjectName,
  topicNameById,
}: {
  roadmap: StudyRoadmap;
  subjectName: string;
  topicNameById: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const completeMutation = useMutation({
    mutationFn: ({ topicId, stage }: { topicId: string; stage: StudyRoadmapStage['stage'] }) =>
      completeRoadmapStage(roadmap.id, topicId, stage),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      showToast(
        updated.status === 'COMPLETED'
          ? `🎉 Đã hoàn thành lộ trình ${subjectName}!`
          : 'Đã cập nhật lộ trình',
        'success',
      );
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const practiceMutation = useMutation({
    mutationFn: (topicId: string) => generateTopicPractice(topicId),
    onSuccess: (exam) => navigate(`/student/exams/${exam.id}/attempt`),
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const stagesByTopic = new Map<string, StudyRoadmapStage[]>();
  for (const stage of roadmap.stages) {
    const list = stagesByTopic.get(stage.topicId) ?? [];
    list.push(stage);
    stagesByTopic.set(stage.topicId, list);
  }

  return (
    <Card className="p-5">
      <p className="mb-4 font-semibold text-slate-900 dark:text-slate-100">{subjectName}</p>
      <div className="space-y-5">
        {[...stagesByTopic.entries()].map(([topicId, stages]) => {
          const currentStage = stages.find((s) => s.status !== 'COMPLETED');
          const doneCount = stages.filter((s) => s.status === 'COMPLETED').length;
          return (
            <div key={topicId}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {topicNameById.get(topicId) ?? 'Chuyên đề'}
                </p>
                <span className="text-xs text-slate-400">
                  {doneCount}/{stages.length}
                </span>
              </div>
              <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                  style={{ width: `${(doneCount / stages.length) * 100}%` }}
                />
              </div>
              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stages.map((stage) => {
                  const isDone = stage.status === 'COMPLETED';
                  const isCurrent = !isDone && stage === currentStage;
                  return (
                    <li
                      key={stage.stage}
                      className={`flex items-center gap-2.5 rounded-xl p-3 text-sm transition ${
                        isCurrent
                          ? 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-300 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-700'
                          : isDone
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircleIcon className="h-4 w-4 shrink-0" />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                          {stages.indexOf(stage) + 1}
                        </span>
                      )}
                      {STAGE_LABEL[stage.stage] ?? stage.stage}
                    </li>
                  );
                })}
              </ol>
              {currentStage ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => practiceMutation.mutate(topicId)}
                    disabled={practiceMutation.isPending}
                  >
                    {practiceMutation.isPending ? 'Đang tạo đề...' : 'Luyện ngay'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => completeMutation.mutate({ topicId, stage: currentStage.stage })}
                    disabled={completeMutation.isPending}
                  >
                    {completeMutation.isPending ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
                  </Button>
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Đã hoàn thành chuyên đề này
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function StudentRoadmapPage() {
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const weaknessesQuery = useQuery({ queryKey: ['weaknesses'], queryFn: () => fetchMyWeaknesses() });
  const roadmapQuery = useQuery({ queryKey: ['roadmap'], queryFn: () => fetchMyRoadmap() });
  const completedRoadmapQuery = useQuery({
    queryKey: ['roadmap', 'completed'],
    queryFn: () => fetchMyRoadmap(undefined, 'COMPLETED'),
  });

  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));
  const roadmapSubjectIds = [
    ...new Set(
      [...(roadmapQuery.data ?? []), ...(completedRoadmapQuery.data ?? [])].map((r) => r.subjectId),
    ),
  ];
  const topicsQueries = useQueries({
    queries: roadmapSubjectIds.map((subjectId) => ({
      queryKey: ['topics', subjectId],
      queryFn: () => fetchTopics(subjectId),
    })),
  });
  const topicNameById = new Map(
    topicsQueries.flatMap((q) => (q.data ?? []).map((t) => [t.id, t.name] as const)),
  );

  const isLoading = weaknessesQuery.isLoading || roadmapQuery.isLoading;
  const error = weaknessesQuery.error || roadmapQuery.error;

  return (
    <div>
      <PageHeader
        title="Điểm yếu & lộ trình ôn tập AI"
        subtitle="Phân tích tự động sau mỗi bài thi, kèm lời khuyên ôn tập do AI viết riêng cho bạn"
        icon={<RouteIcon className="h-5 w-5" />}
      />

      <ProgressDashboard />

      <BadgesGrid />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {weaknessesQuery.data && weaknessesQuery.data.length === 0 && (
        <EmptyState label="Chưa có phân tích điểm yếu nào. Hãy làm ít nhất một bài thi để AI phân tích." />
      )}

      <div className="space-y-4">
        {weaknessesQuery.data?.map((analysis) => (
          <Card key={analysis.id} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30">
                <TargetIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {subjectNameById.get(analysis.subjectId) ?? 'Môn học'}
                </p>
                <p className="text-xs text-slate-400">
                  Phân tích ngày {new Date(analysis.generatedAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
            {analysis.weakTopics.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" />
                Không phát hiện chuyên đề yếu trong lần này.
              </p>
            ) : (
              <ul className="space-y-3">
                {analysis.weakTopics.map((wt) => {
                  const advice = analysis.details?.adviceByTopic?.[wt.topicId];
                  return (
                    <li
                      key={wt.topicId}
                      className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-500/5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Chuyên đề cần ôn tập ưu tiên — đúng {wt.correct}/{wt.total} câu
                        </p>
                        {wt.persistentCount > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
                            Yếu liên tục {wt.persistentCount} lần
                          </span>
                        )}
                      </div>
                      {advice && (
                        <p className="mt-2 flex items-start gap-2 rounded-lg bg-white/70 p-2.5 text-xs text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                          <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                          {advice}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <h2 className="mb-4 mt-10 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        <AwardIcon className="h-5 w-5 text-indigo-500" />
        Lộ trình đang thực hiện
      </h2>
      {roadmapQuery.data && roadmapQuery.data.length === 0 && (
        <EmptyState label="Chưa có lộ trình ôn tập nào được tạo." />
      )}
      <div className="space-y-4">
        {roadmapQuery.data?.map((roadmap) => (
          <RoadmapCard
            key={roadmap.id}
            roadmap={roadmap}
            subjectName={subjectNameById.get(roadmap.subjectId) ?? 'Môn học'}
            topicNameById={topicNameById}
          />
        ))}
      </div>

      {completedRoadmapQuery.data && completedRoadmapQuery.data.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            Lộ trình đã hoàn thành
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {completedRoadmapQuery.data.map((roadmap) => (
              <Card
                key={roadmap.id}
                className="flex items-center gap-3 border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-500/5"
              >
                <span className="text-xl">🎉</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {subjectNameById.get(roadmap.subjectId) ?? 'Môn học'}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Đã hoàn thành mọi chuyên đề trong lộ trình
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
