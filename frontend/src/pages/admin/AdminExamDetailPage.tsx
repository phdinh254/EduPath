import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { addExamQuestion, fetchExam, fetchExamAttempts, fetchExamQuestions } from '../../features/exams/examsApi';
import { fetchQuestions } from '../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

export function AdminExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [questionId, setQuestionId] = useState('');
  const [maxScore, setMaxScore] = useState(0.25);
  const [formError, setFormError] = useState<string | null>(null);

  const examQuery = useQuery({ queryKey: ['exam', examId], queryFn: () => fetchExam(examId!), enabled: !!examId });
  const examQuestionsQuery = useQuery({
    queryKey: ['exam-questions', examId],
    queryFn: () => fetchExamQuestions(examId!),
    enabled: !!examId,
  });
  const questionBankQuery = useQuery({
    queryKey: ['admin-questions', 'APPROVED'],
    queryFn: () => fetchQuestions('APPROVED'),
  });
  const attemptsQuery = useQuery({
    queryKey: ['exam-attempts', examId],
    queryFn: () => fetchExamAttempts(examId!),
    enabled: !!examId,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addExamQuestion(examId!, { questionId, order: (examQuestionsQuery.data?.length ?? 0) + 1, maxScore }),
    onSuccess: () => {
      showToast('Đã thêm câu hỏi vào đề', 'success');
      setQuestionId('');
      queryClient.invalidateQueries({ queryKey: ['exam-questions', examId] });
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!questionId) return;
    addMutation.mutate();
  }

  const usedQuestionIds = new Set(examQuestionsQuery.data?.map((eq) => eq.questionId));
  const availableQuestions = (questionBankQuery.data ?? []).filter((q) => !usedQuestionIds.has(q.id));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{examQuery.data?.title}</h1>
      <p className="mb-6 text-sm text-slate-500">{examQuery.data?.durationMinutes} phút</p>

      <h2 className="mb-3 text-lg font-medium text-slate-900 dark:text-slate-100">Câu hỏi trong đề</h2>
      {examQuestionsQuery.isLoading && <LoadingState />}
      {examQuestionsQuery.data && examQuestionsQuery.data.length === 0 && (
        <EmptyState label="Đề thi chưa có câu hỏi nào." />
      )}
      <div className="mb-6 space-y-2">
        {examQuestionsQuery.data?.map((eq) => (
          <div key={eq.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            Câu {eq.order} ({eq.maxScore} điểm): {eq.question.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mb-8 flex max-w-xl gap-2">
        <select
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Chọn câu hỏi đã duyệt để thêm vào đề</option>
          {availableQuestions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.content.slice(0, 60)}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.25"
          min={0}
          value={maxScore}
          onChange={(e) => setMaxScore(Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={addMutation.isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          Thêm
        </button>
      </form>
      {formError && <ErrorState message={formError} />}

      <h2 className="mb-3 text-lg font-medium text-slate-900 dark:text-slate-100">Kết quả học sinh</h2>
      {attemptsQuery.isLoading && <LoadingState />}
      {attemptsQuery.error && <ErrorState message={getApiErrorMessage(attemptsQuery.error)} />}
      {attemptsQuery.data && attemptsQuery.data.length === 0 && (
        <EmptyState label="Chưa có học sinh nào làm đề thi này." />
      )}
      <div className="space-y-2">
        {attemptsQuery.data?.map((attempt) => (
          <div
            key={attempt.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
          >
            <span>{attempt.student?.fullName}</span>
            <span className="text-slate-500">
              {attempt.status === 'IN_PROGRESS' ? 'Đang làm bài' : `${attempt.totalScore?.toFixed(2)} điểm`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
