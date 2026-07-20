import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchAttempt, fetchAttemptReview } from '../../features/exams/examsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ErrorState, LoadingState } from '../../components/StateViews';

function formatResponse(response: unknown, options: unknown): string {
  if (response == null) return 'Chưa trả lời';
  const r = response as Record<string, unknown>;
  if (typeof r.index === 'number') {
    const opts = options as string[] | null;
    return opts?.[r.index] ?? String(r.index);
  }
  if (Array.isArray(r.statements)) {
    return (r.statements as boolean[]).map((s) => (s ? 'Đúng' : 'Sai')).join(', ');
  }
  if (typeof r.value === 'string') return r.value;
  if (typeof r.text === 'string') return r.text;
  return JSON.stringify(response);
}

function formatCorrectAnswer(correctAnswer: unknown, options: unknown): string {
  if (correctAnswer == null) return '—';
  const c = correctAnswer as Record<string, unknown>;
  if (typeof c.index === 'number') {
    const opts = options as string[] | null;
    return opts?.[c.index] ?? String(c.index);
  }
  if (Array.isArray(c.statements)) {
    return (c.statements as boolean[]).map((s) => (s ? 'Đúng' : 'Sai')).join(', ');
  }
  if (typeof c.value === 'string') return c.value;
  return JSON.stringify(correctAnswer);
}

export function StudentResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetchAttempt(attemptId!),
    enabled: !!attemptId,
  });
  const reviewQuery = useQuery({
    queryKey: ['attempt-review', attemptId],
    queryFn: () => fetchAttemptReview(attemptId!),
    enabled: !!attemptId,
  });

  if (attemptQuery.isLoading || reviewQuery.isLoading) return <LoadingState label="Đang tải kết quả..." />;
  if (attemptQuery.error) return <ErrorState message={getApiErrorMessage(attemptQuery.error)} />;
  if (reviewQuery.error) return <ErrorState message={getApiErrorMessage(reviewQuery.error)} />;

  const attempt = attemptQuery.data!;
  const review = reviewQuery.data ?? [];

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Kết quả bài thi</h1>
      <p className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {attempt.totalScore != null ? attempt.totalScore.toFixed(2) : '—'} điểm
        <span className="ml-2 text-sm font-normal text-slate-500">
          ({attempt.status === 'GRADED' ? 'Đã chấm xong' : 'Đang chờ giáo viên duyệt một phần'})
        </span>
      </p>

      <div className="space-y-4">
        {review.map((item, index) => (
          <div key={item.questionId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">
              Câu {index + 1}: {item.content}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Bạn trả lời: {formatResponse(item.response, item.options)}
            </p>

            {item.type !== 'ESSAY' ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Đáp án đúng: {formatCorrectAnswer(item.correctAnswer, item.options)}
                </p>
                {item.explanation && (
                  <p className="mt-1 text-sm text-slate-500 italic">Giải thích: {item.explanation}</p>
                )}
                <p
                  className={`mt-1 text-sm font-medium ${item.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {item.isCorrect ? 'Đúng' : 'Sai'} · {item.scoreAwarded ?? 0}/{item.maxScore} điểm
                </p>
              </>
            ) : (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                {item.aiComment && <p className="mb-1 text-slate-600 dark:text-slate-400">{item.aiComment}</p>}
                {item.isAiReferenceOnly ? (
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Điểm AI tham khảo, chưa được giáo viên duyệt. ({item.scoreAwarded ?? item.aiPreliminaryScore}/
                    {item.maxScore} điểm)
                  </p>
                ) : item.scoreAwarded === null ? (
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Đang chờ giáo viên duyệt điểm (AI chấm sơ bộ: {item.aiPreliminaryScore}/{item.maxScore})
                  </p>
                ) : (
                  <p className="font-medium text-emerald-600">
                    Điểm chính thức: {item.scoreAwarded}/{item.maxScore} (đã giáo viên duyệt)
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
