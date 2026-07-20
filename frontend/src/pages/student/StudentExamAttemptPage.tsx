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
          <label key={index} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
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
          <label key={index} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
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
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Làm bài thi</h1>
      <div className="space-y-6">
        {questionsQuery.data?.map((eq, index) => (
          <div key={eq.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-3 font-medium text-slate-900 dark:text-slate-100">
              Câu {index + 1} ({eq.maxScore} điểm): {eq.question.content}
            </p>
            <QuestionInput
              examQuestion={eq}
              value={answers[eq.questionId]}
              onChange={(response) => handleAnswerChange(eq.questionId, response)}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
        className="mt-6 rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitMutation.isPending ? 'Đang nộp bài...' : 'Nộp bài'}
      </button>
    </div>
  );
}
