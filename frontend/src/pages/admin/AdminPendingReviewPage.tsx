import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAiQualityStats, fetchPendingReview, reviewEssayAnswer } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, Card, PageHeader } from '../../components/ui/Card';
import { ClipboardCheckIcon, SparklesIcon } from '../../components/ui/Icons';
import type { PendingReviewAnswer } from '../../types/api';

function AiQualityStatsPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['ai-quality-stats'], queryFn: fetchAiQualityStats });

  if (isLoading) return <LoadingState label="Đang tính độ lệch điểm AI..." />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data || data.sampleSize === 0) {
    return (
      <Card className="mb-6 p-5 text-sm text-slate-500 dark:text-slate-400">
        Chưa đủ dữ liệu để đo độ lệch — cần ít nhất một lần ADMIN hậu kiểm/chấm tay một câu tự luận đã có điểm AI ban đầu.
      </Card>
    );
  }

  const withinPercent = data.withinToleranceRate != null ? Math.round(data.withinToleranceRate * 100) : null;

  return (
    <Card className="mb-6 p-5">
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Độ lệch điểm AI vs người chấm ({data.sampleSize} lượt hậu kiểm)
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Sai số trung bình</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.meanAbsoluteDeviation} điểm</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Sai số lớn nhất</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.maxDeviation} điểm</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Trong ngưỡng ±{data.toleranceScore}đ</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{withinPercent}%</p>
        </div>
      </div>
      {data.byModel.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {data.byModel.map((m) => (
            <p key={m.model}>
              {m.model}: sai số TB {m.meanAbsoluteDeviation} điểm ({m.sampleSize} mẫu)
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AdminPendingReviewPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [reviewing, setReviewing] = useState<PendingReviewAnswer | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['pending-review'], queryFn: fetchPendingReview });

  const reviewMutation = useMutation({
    mutationFn: () => reviewEssayAnswer(reviewing!.id, { finalScore, comment: comment || undefined }),
    onSuccess: () => {
      showToast('Đã cập nhật điểm chính thức', 'success');
      setReviewing(null);
      queryClient.invalidateQueries({ queryKey: ['pending-review'] });
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function openReview(answer: PendingReviewAnswer) {
    setFinalScore(answer.scoreAwarded ?? answer.aiPreliminaryScore ?? 0);
    setComment('');
    setFormError(null);
    setReviewing(answer);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    reviewMutation.mutate();
  }

  const urgentCount = data?.filter((a) => a.needsManualGrading).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Hậu kiểm điểm Văn"
        subtitle="Bài đánh dấu 'Cần chấm gấp' chưa hề công bố điểm cho học sinh — các bài còn lại AI đã chấm và công bố rồi, chỉ để spot-check chất lượng"
        icon={<ClipboardCheckIcon className="h-5 w-5" />}
      />

      <AiQualityStatsPanel />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Không có bài nào cần hậu kiểm." />}
      {urgentCount > 0 && (
        <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
          {urgentCount} bài đang chờ chấm gấp — học sinh chưa thấy điểm cho tới khi được chấm.
        </p>
      )}

      <div className="space-y-4">
        {data?.map((answer) => (
          <Card key={answer.id} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {answer.attempt.student.fullName} — {answer.attempt.exam.title}
                </p>
                <p className="text-xs text-slate-500">Đề bài: {answer.question.content}</p>
              </div>
              <Button onClick={() => openReview(answer)} className="shrink-0 px-3 py-1.5 text-xs">
                {answer.needsManualGrading ? 'Chấm điểm' : 'Điều chỉnh điểm'}
              </Button>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {(answer.response as { text?: string } | null)?.text ?? '(không có nội dung)'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs">
              {answer.needsManualGrading ? (
                <Badge variant="red">Cần chấm gấp — chưa công bố điểm</Badge>
              ) : (
                <Badge variant="amber">
                  <SparklesIcon className="h-3 w-3" />
                  AI chấm: {answer.scoreAwarded ?? answer.aiPreliminaryScore} điểm
                </Badge>
              )}
              <span className="text-slate-500 dark:text-slate-400">{answer.aiComment}</span>
            </p>
          </Card>
        ))}
      </div>

      {reviewing && (
        <Modal title="Điều chỉnh điểm bài Văn" onClose={() => setReviewing(null)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-400">Điểm chính thức</label>
            <input
              type="number"
              step="0.25"
              min={0}
              required
              value={finalScore}
              onChange={(e) => setFinalScore(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <label className="text-sm text-slate-600 dark:text-slate-400">Nhận xét (tuỳ chọn)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            {formError && <ErrorState message={formError} />}
            <button
              type="submit"
              disabled={reviewMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {reviewMutation.isPending ? 'Đang lưu...' : 'Cập nhật điểm'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
