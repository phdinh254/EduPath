import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchAttempt, fetchAttemptReview } from '../../features/exams/examsApi';
import { explainWrongAnswer } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { Card } from '../../components/ui/Card';
import { CheckCircleIcon, SparklesIcon, XCircleIcon } from '../../components/ui/Icons';

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

function WrongAnswerExplain({ answerId, cached }: { answerId: string; cached: string | null }) {
  const [explanation, setExplanation] = useState<string | null>(cached);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => explainWrongAnswer(answerId),
    onSuccess: (data) => setExplanation(data.aiExplanation),
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (explanation) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
        <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0" />
        {explanation}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => {
          setError(null);
          mutation.mutate();
        }}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
      >
        <SparklesIcon className="h-3.5 w-3.5" />
        {mutation.isPending ? 'Đang hỏi AI...' : 'Giải thích tại sao sai'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
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
  const correctCount = review.filter((r) => r.isCorrect === true).length;

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-center text-white shadow-lg shadow-indigo-500/30 sm:flex-row sm:text-left">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/15 text-3xl font-bold">
          {attempt.totalScore != null ? attempt.totalScore.toFixed(1) : '—'}
        </div>
        <div>
          <p className="text-sm font-medium text-indigo-100">Kết quả bài thi</p>
          <p className="text-lg font-semibold">
            {attempt.totalScore != null ? `${attempt.totalScore.toFixed(2)} điểm` : 'Đang chấm...'}
          </p>
          <p className="text-sm text-indigo-100">
            {attempt.status === 'GRADED' ? 'Đã chấm xong' : 'Đang chấm...'} · {correctCount}/{review.length} câu đúng
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {review.map((item, index) => (
          <Card key={item.questionId} className="p-5">
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
                  <p className="mt-1 text-sm italic text-slate-500">Giải thích: {item.explanation}</p>
                )}
                <p
                  className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${item.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {item.isCorrect ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                  {item.isCorrect ? 'Đúng' : 'Sai'} · {item.scoreAwarded ?? 0}/{item.maxScore} điểm
                </p>
                {item.isCorrect === false && item.answerId && (
                  <WrongAnswerExplain answerId={item.answerId} cached={item.aiExplanation} />
                )}
              </>
            ) : (
              <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
                {item.aiComment && <p className="mb-1 text-slate-600 dark:text-slate-400">{item.aiComment}</p>}
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {item.scoreAwarded ?? item.aiPreliminaryScore}/{item.maxScore} điểm — điểm tham khảo do AI đánh giá
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
