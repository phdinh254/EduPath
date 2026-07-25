import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchAttempt,
  fetchExam,
  fetchExamQuestions,
  saveAnswer,
  saveAnswerTime,
  startAttempt,
} from '../../features/exams/examsApi';
import { submitAttempt } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { Button } from '../../components/ui/Card';
import { Calculator } from '../../components/ui/Calculator';
import { CalculatorIcon, ClockIcon, StarIcon, XIcon } from '../../components/ui/Icons';
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

function QuestionNavButton({
  index,
  isCurrent,
  isAnswered,
  isStarred,
  onClick,
}: {
  index: number;
  isCurrent: boolean;
  isAnswered: boolean;
  isStarred: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition ${
        isCurrent
          ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm'
          : isAnswered
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {index + 1}
      {isStarred && <StarIcon className="absolute -right-1 -top-1 h-3 w-3 fill-amber-500 text-amber-500" />}
    </button>
  );
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StudentExamAttemptPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [showCalculator, setShowCalculator] = useState(false);
  const hasStartedRef = useRef(false);
  const autoSubmittedRef = useRef(false);

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

  // Câu đánh dấu yêu thích chỉ là gợi nhớ cá nhân trong lúc làm bài — lưu cục
  // bộ theo attemptId, không cần đồng bộ backend.
  useEffect(() => {
    if (!attemptId) return;
    const raw = localStorage.getItem(`starred-${attemptId}`);
    if (!raw) return;
    try {
      setStarred(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* bỏ qua dữ liệu hỏng */
    }
  }, [attemptId]);

  function toggleStar(questionId: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      if (attemptId) localStorage.setItem(`starred-${attemptId}`, JSON.stringify([...next]));
      return next;
    });
  }

  const examQuery = useQuery({ queryKey: ['exam', examId], queryFn: () => fetchExam(examId!), enabled: !!examId });

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

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    const startedAt = attemptQuery.data?.startedAt;
    const durationMinutes = examQuery.data?.durationMinutes;
    if (!startedAt || !durationMinutes) return;
    const deadline = new Date(startedAt).getTime() + durationMinutes * 60_000;

    function tick() {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs === 0 && !autoSubmittedRef.current && attemptId) {
        autoSubmittedRef.current = true;
        flushPendingTime();
        submitMutation.mutate();
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptQuery.data?.startedAt, examQuery.data?.durationMinutes, attemptId]);

  function handleAnswerChange(questionId: string, response: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    saveMutation.mutate({ questionId, response });
  }

  // Ghi nhận thời gian làm từng câu — phục vụ phân tích điểm yếu AI (câu/chuyên
  // đề mất nhiều thời gian bất thường). Dùng ref thay vì cleanup của effect vì
  // cần chốt thời gian TRƯỚC khi gọi nộp bài (chứ không phải sau, lúc đó lượt
  // làm bài đã kết thúc và backend sẽ từ chối ghi nhận thêm).
  const timeTrackingRef = useRef<{ questionId: string; enteredAt: number } | null>(null);

  function flushPendingTime() {
    const track = timeTrackingRef.current;
    timeTrackingRef.current = null;
    if (!track || !attemptId) return;
    const elapsed = Math.round((Date.now() - track.enteredAt) / 1000);
    if (elapsed > 0) {
      saveAnswerTime(attemptId, track.questionId, elapsed).catch(() => {
        /* mất một khoảng thời gian ghi nhận không ảnh hưởng bài làm chính */
      });
    }
  }

  const currentQuestionId = questionsQuery.data?.[currentIndex]?.questionId;
  useEffect(() => {
    flushPendingTime();
    if (currentQuestionId && attemptId) {
      timeTrackingRef.current = { questionId: currentQuestionId, enteredAt: Date.now() };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionId, attemptId]);

  // Rời trang giữa chừng (bấm Thoát) mà không qua nộp bài — vẫn chốt thời gian còn dang dở.
  useEffect(() => {
    return () => flushPendingTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (startError) return <ErrorState message={startError} />;
  if (!attemptId || questionsQuery.isLoading) return <LoadingState label="Đang chuẩn bị bài thi..." />;
  if (questionsQuery.error) return <ErrorState message={getApiErrorMessage(questionsQuery.error)} />;

  const questions = questionsQuery.data ?? [];
  const total = questions.length;
  const current = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === total - 1;
  const sections = examQuery.data?.sections ?? [];
  const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));
  const currentSectionName = current?.sectionId ? sectionNameById.get(current.sectionId) : undefined;

  return (
    <div>
      {/* Thanh trên: thoát, tiêu đề, đồng hồ, máy tính, yêu thích */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/student/exams')}
            title="Thoát"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <XIcon className="h-5 w-5" />
          </button>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{examQuery.data?.title ?? 'Làm bài thi'}</p>
            <p className="text-xs text-slate-500">
              Câu {currentIndex + 1}/{total} · Đã trả lời {answeredCount}/{total}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {remainingSeconds != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold ${
                remainingSeconds < 300
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <ClockIcon className="h-4 w-4" />
              {formatTime(remainingSeconds)}
            </span>
          )}
          <button
            onClick={() => setShowCalculator((v) => !v)}
            title="Máy tính"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              showCalculator
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CalculatorIcon className="h-5 w-5" />
          </button>
          {current && (
            <button
              onClick={() => toggleStar(current.questionId)}
              title="Đánh dấu câu này để xem lại"
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                starred.has(current.questionId)
                  ? 'text-amber-500'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <StarIcon className="h-5 w-5" fill={starred.has(current.questionId) ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {current && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          {currentSectionName && (
            <p className="mb-2 inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              {currentSectionName}
            </p>
          )}
          <p className="mb-3 font-medium text-slate-900 dark:text-slate-100">
            <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {currentIndex + 1}
            </span>
            {current.question.content}
            <span className="ml-2 text-xs font-normal text-slate-400">({current.maxScore} điểm)</span>
          </p>
          <QuestionInput
            examQuestion={current}
            value={answers[current.questionId]}
            onChange={(response) => handleAnswerChange(current.questionId, response)}
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
          ← Câu trước
        </Button>
        {isLast ? (
          <Button
            variant="success"
            onClick={() => {
              flushPendingTime();
              submitMutation.mutate();
            }}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Đang nộp bài...' : 'Nộp bài'}
          </Button>
        ) : (
          <Button onClick={() => setCurrentIndex((i) => i + 1)}>Câu tiếp →</Button>
        )}
      </div>

      {/* Lưới điều hướng câu hỏi — gộp theo phần thi nếu đề có nhiều phần (ĐGNL) */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Danh sách câu hỏi</p>
        {sections.length > 1 ? (
          <div className="space-y-4">
            {sections.map((section) => {
              const items = questions
                .map((eq, index) => ({ eq, index }))
                .filter(({ eq }) => eq.sectionId === section.id);
              if (items.length === 0) return null;
              return (
                <div key={section.id}>
                  <p className="mb-2 text-xs font-semibold text-violet-700 dark:text-violet-300">{section.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(({ eq, index }) => (
                      <QuestionNavButton
                        key={eq.id}
                        index={index}
                        isCurrent={index === currentIndex}
                        isAnswered={answers[eq.questionId] != null}
                        isStarred={starred.has(eq.questionId)}
                        onClick={() => setCurrentIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {questions.map((eq, index) => (
              <QuestionNavButton
                key={eq.id}
                index={index}
                isCurrent={index === currentIndex}
                isAnswered={answers[eq.questionId] != null}
                isStarred={starred.has(eq.questionId)}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      {showCalculator && (
        <div className="fixed bottom-6 right-6 z-50">
          <Calculator onClose={() => setShowCalculator(false)} />
        </div>
      )}
    </div>
  );
}
