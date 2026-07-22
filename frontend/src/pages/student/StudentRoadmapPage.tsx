import { useQuery } from '@tanstack/react-query';
import { fetchMyRoadmap, fetchMyWeaknesses } from '../../features/roadmap/roadmapApi';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

const STAGE_LABEL: Record<string, string> = {
  REVIEW_THEORY: 'Ôn lý thuyết nền tảng',
  BASIC_PRACTICE: 'Làm bài cơ bản',
  ADVANCED_PRACTICE: 'Luyện bài vận dụng',
  RETEST: 'Kiểm tra lại',
};

export function StudentRoadmapPage() {
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const weaknessesQuery = useQuery({ queryKey: ['weaknesses'], queryFn: () => fetchMyWeaknesses() });
  const roadmapQuery = useQuery({ queryKey: ['roadmap'], queryFn: () => fetchMyRoadmap() });

  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));
  const isLoading = weaknessesQuery.isLoading || roadmapQuery.isLoading;
  const error = weaknessesQuery.error || roadmapQuery.error;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">
        Điểm yếu &amp; lộ trình ôn tập AI
      </h1>
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {weaknessesQuery.data && weaknessesQuery.data.length === 0 && (
        <EmptyState label="Chưa có phân tích điểm yếu nào. Hãy làm ít nhất một bài thi để AI phân tích." />
      )}

      <div className="space-y-6">
        {weaknessesQuery.data?.map((analysis) => (
          <div key={analysis.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">
              {subjectNameById.get(analysis.subjectId) ?? 'Môn học'} — phân tích ngày{' '}
              {new Date(analysis.generatedAt).toLocaleDateString('vi-VN')}
            </p>
            {analysis.weakTopics.length === 0 ? (
              <p className="text-sm text-emerald-600">Không phát hiện chuyên đề yếu trong lần này.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {analysis.weakTopics.map((wt) => {
                  const advice = analysis.details?.adviceByTopic?.[wt.topicId];
                  return (
                    <li key={wt.topicId} className="list-disc pl-5">
                      Chuyên đề cần ôn tập ưu tiên — đúng {wt.correct}/{wt.total} câu
                      {advice && (
                        <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          🤖 {advice}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Lộ trình đang thực hiện</h2>
      {roadmapQuery.data && roadmapQuery.data.length === 0 && (
        <EmptyState label="Chưa có lộ trình ôn tập nào được tạo." />
      )}
      <div className="space-y-4">
        {roadmapQuery.data?.map((roadmap) => (
          <div key={roadmap.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-3 font-medium text-slate-900 dark:text-slate-100">
              {subjectNameById.get(roadmap.subjectId) ?? 'Môn học'}
            </p>
            <ol className="space-y-2">
              {roadmap.stages.map((stage, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs dark:bg-slate-800">
                    {index + 1}
                  </span>
                  {STAGE_LABEL[stage.stage] ?? stage.stage}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
