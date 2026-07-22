import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPendingReview, reviewEssayAnswer } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
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
      <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Hậu kiểm điểm Văn</h1>
      <p className="mb-6 text-sm text-slate-500">
        AI đã chấm và công bố điểm cho học sinh — đây là danh sách để bạn spot-check chất lượng AI và điều chỉnh nếu cần.
      </p>
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Không có bài nào cần hậu kiểm." />}

      <div className="space-y-3">
        {data?.map((answer) => (
          <div key={answer.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {answer.attempt.student.fullName} — {answer.attempt.exam.title}
                </p>
                <p className="text-xs text-slate-500">Đề bài: {answer.question.content}</p>
              </div>
              <button
                onClick={() => openReview(answer)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-slate-900"
              >
                Điều chỉnh điểm
              </button>
            </div>
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {(answer.response as { text?: string } | null)?.text ?? '(không có nội dung)'}
            </p>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              AI chấm: {answer.scoreAwarded ?? answer.aiPreliminaryScore} điểm (điểm tham khảo do AI đánh giá) — {answer.aiComment}
            </p>
          </div>
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
