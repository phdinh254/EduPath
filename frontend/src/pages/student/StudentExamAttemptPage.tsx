import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchAttempt,
  fetchExamQuestions,
  saveAnswer,
  startAttempt,
} from '../../features/exams/examsApi';
import { submitAttempt } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { Button, Card, PageHeader } from '../../components/ui/Card';
import { FileTextIcon } from '../../components/ui/Icons';
import type { ExamQuestion } from '../../types/api';

function QuestionInput({
  examQuestion,
  value,
  onChange,
}: {
  examQuestion: ExamQuestion;
  value: unknown;
  onChange: (response: unknown) => void;
}) {
  const { question } = examQuestion;

  if (question.type === 'MULTIPLE_CHOICE') {
    const options = (question.options as string[] | null) ?? [];
    const selected = (value as { index?: number } | null)?.index;
    return (
      <div className="space-y-2">
        {options.map((option, index) => (
          <label
            key={index}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
              selected === index
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <input
              type="radio"
              className="accent-indigo-600"
              checked={selected === index}
              onChange={() => onChange({ index })}
              name={`q-${examQuestion.questionId}`}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'TRUE_FALSE') {
    const statements = (value as { statements?: boolean[] } | null)?.statements ?? [false, false, false, false];
    return (
      <div className="space-y-2">
        {statements.map((checked, index) => (
          <label
            key={index}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
              checked
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <input
              type="checkbox"
              className="accent-indigo-600"
              checked={checked}
              onChange={(e) => {
                const next = [...statements];
                next[index] = e.target.checked;
                onChange({ statements: next });
              }}
            />
            Ý {String.fromCharCode(97 + index)}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'SHORT_ANSWER') {
    return (
      <input
        defaultValue={(value as { value?: string } | null)?.value ?? ''}
        onBlur={(e) => onChange({ value: e.target.value })}
        className="w-full max-w-sm rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/20"
        placeholder="Nhập câu trả lời ngắn"
      />
    );
  }

  // ESSAY
  return (
    <textarea
      defaultValue={(value as { text?: string } | null)?.text ?? ''}
      onBlur={(e) => onChange({ text: e.target.value })}
      rows={8}
      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/20"
      placeholder="Viết bài làm của bạn ở đây"
    />
  );
}

export function StudentExamAttemptPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!examId || hasStartedRef.current) return;
    hasStartedRef.current = true;
    startAttempt(examId)
      .then((attempt) => {
        if (attempt.status !== 'IN_PROGRESS') {
          navigate(`/student/attempts/${attempt.id}/result`, { replace: true });
          return;
        }
        setAttemptId(attempt.id);
      })
      .catch((err) => {
        hasStartedRef.current = false;
        setStartError(getApiErrorMessage(err));
      });
  }, [examId, navigate]);

  const questionsQuery = useQuery({
    queryKey: ['exam-questions', examId],
    queryFn: () => fetchExamQuestions(examId!),
    enabled: !!examId,
  });

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetchAttempt(attemptId!),
    enabled: !!attemptId,
  });

  useEffect(() => {
    if (attemptQuery.data?.answers) {
      const prefilled: Record<string, unknown> = {};
      for (const answer of attemptQuery.data.answers) {
        prefilled[answer.questionId] = answer.response;
      }
      setAnswers((prev) => ({ ...prefilled, ...prev }));
    }
  }, [attemptQuery.data]);

  const saveMutation = useMutation({
    mutationFn: ({ questionId, response }: { questionId: string; response: unknown }) =>
      saveAnswer(attemptId!, questionId, response),
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitAttempt(attemptId!),
    onSuccess: (attempt) => {
      showToast('Nộp bài thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      navigate(`/student/attempts/${attempt.id}/result`, { replace: true });
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function handleAnswerChange(questionId: string, response: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    saveMutation.mutate({ questionId, response });
  }

  if (startError) return <ErrorState message={startError} />;
  if (!attemptId || questionsQuery.isLoading) return <LoadingState label="Đang chuẩn bị bài thi..." />;
  if (questionsQuery.error) return <ErrorState message={getApiErrorMessage(questionsQuery.error)} />;

  const total = questionsQuery.data?.length ?? 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <PageHeader
        title="Làm bài thi"
        subtitle={`Đã trả lời ${answeredCount}/${total} câu — câu trả lời được lưu tự động`}
        icon={<FileTextIcon className="h-5 w-5" />}
      />
      <div className="space-y-4">
        {questionsQuery.data?.map((eq, index) => (
          <Card key={eq.id} className="p-5">
            <p className="mb-3 font-medium text-slate-900 dark:text-slate-100">
              <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {index + 1}
              </span>
              {eq.question.content}
              <span className="ml-2 text-xs font-normal text-slate-400">({eq.maxScore} điểm)</span>
            </p>
            <QuestionInput
              examQuestion={eq}
              value={answers[eq.questionId]}
              onChange={(response) => handleAnswerChange(eq.questionId, response)}
            />
          </Card>
        ))}
      </div>
      <Button
        variant="success"
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
        className="mt-6 w-full sm:w-auto"
      >
        {submitMutation.isPending ? 'Đang nộp bài...' : 'Nộp bài'}
      </Button>
    </div>
  );
}
