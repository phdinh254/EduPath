import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { completeRoadmapStage } from '../../../features/roadmap/roadmapApi';
import { generateTopicPractice } from '../../../features/exams/examsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { Button, Card } from '../../../components/ui/Card';
import { CheckCircleIcon } from '../../../components/ui/Icons';
import type { StudyRoadmap, StudyRoadmapStage } from '../../../types/api';
import { STAGE_LABEL } from './roadmapConstants';

// Nhóm các giai đoạn theo chuyên đề, tìm giai đoạn hiện tại (giai đoạn PENDING
// đầu tiên theo đúng thứ tự) để làm nổi bật và gắn hành động (luyện ngay/đánh
// dấu hoàn thành) — thay vì chỉ hiển thị danh sách tĩnh như trước.
export function RoadmapCard({
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
