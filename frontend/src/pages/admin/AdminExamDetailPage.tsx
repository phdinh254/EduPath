import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { addExamQuestion, fetchExam, fetchExamAttempts, fetchExamQuestions } from '../../features/exams/examsApi';
import { fetchQuestions } from '../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, Card } from '../../components/ui/Card';
import { ClockIcon, FileTextIcon } from '../../components/ui/Icons';

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
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
          <FileTextIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {examQuery.data?.title}
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <ClockIcon className="h-3.5 w-3.5" />
            {examQuery.data?.durationMinutes} phút
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Câu hỏi trong đề</h2>
      {examQuestionsQuery.isLoading && <LoadingState />}
      {examQuestionsQuery.data && examQuestionsQuery.data.length === 0 && (
        <EmptyState label="Đề thi chưa có câu hỏi nào." />
      )}
      <div className="mb-6 space-y-2">
        {examQuestionsQuery.data?.map((eq) => (
          <Card key={eq.id} className="flex items-center gap-3 p-3 text-sm">
            <Badge>Câu {eq.order}</Badge>
            <span className="text-slate-700 dark:text-slate-300">{eq.question.content}</span>
            <span className="ml-auto shrink-0 text-xs text-slate-400">{eq.maxScore} điểm</span>
          </Card>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mb-8 flex max-w-xl flex-col gap-2 sm:flex-row">
        <select
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-24 dark:border-slate-700 dark:bg-slate-900"
        />
        <Button type="submit" disabled={addMutation.isPending}>
          Thêm
        </Button>
      </form>
      {formError && <ErrorState message={formError} />}

      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Kết quả học sinh</h2>
      {attemptsQuery.isLoading && <LoadingState />}
      {attemptsQuery.error && <ErrorState message={getApiErrorMessage(attemptsQuery.error)} />}
      {attemptsQuery.data && attemptsQuery.data.length === 0 && (
        <EmptyState label="Chưa có học sinh nào làm đề thi này." />
      )}
      <div className="space-y-2">
        {attemptsQuery.data?.map((attempt) => (
          <Card key={attempt.id} className="flex items-center justify-between p-3 text-sm">
            <span className="text-slate-700 dark:text-slate-300">{attempt.student?.fullName}</span>
            {attempt.status === 'IN_PROGRESS' ? (
              <Badge variant="amber">Đang làm bài</Badge>
            ) : (
              <Badge variant="emerald">{attempt.totalScore?.toFixed(2)} điểm</Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
