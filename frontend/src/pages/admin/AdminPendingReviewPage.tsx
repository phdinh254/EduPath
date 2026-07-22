import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPendingReview, reviewEssayAnswer } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, Card, PageHeader } from '../../components/ui/Card';
import { ClipboardCheckIcon, SparklesIcon } from '../../components/ui/Icons';
import type { PendingReviewAnswer } from '../../types/api';

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

  return (
    <div>
      <PageHeader
        title="Hậu kiểm điểm Văn"
        subtitle="AI đã chấm và công bố điểm cho học sinh — spot-check chất lượng AI và điều chỉnh nếu cần"
        icon={<ClipboardCheckIcon className="h-5 w-5" />}
      />
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Không có bài nào cần hậu kiểm." />}

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
                Điều chỉnh điểm
              </Button>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {(answer.response as { text?: string } | null)?.text ?? '(không có nội dung)'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="amber">
                <SparklesIcon className="h-3 w-3" />
                AI chấm: {answer.scoreAwarded ?? answer.aiPreliminaryScore} điểm
              </Badge>
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
