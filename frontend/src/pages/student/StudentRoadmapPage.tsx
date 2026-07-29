import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchMyRoadmap, fetchMyWeaknesses } from '../../features/roadmap/roadmapApi';
import { fetchSubjects, fetchTopics } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ReadinessCard } from '../../components/ReadinessCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Card, PageHeader } from '../../components/ui/Card';
import { AwardIcon, CheckCircleIcon, RouteIcon, SparklesIcon, TargetIcon } from '../../components/ui/Icons';
import { ProgressDashboard } from './components/ProgressDashboard';
import { BadgesGrid } from './components/BadgesGrid';
import { RoadmapCard } from './components/RoadmapCard';

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

      <ReadinessCard subjectNameById={subjectNameById} />

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
