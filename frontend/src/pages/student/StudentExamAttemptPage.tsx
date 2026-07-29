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
import { QuestionInput } from './components/QuestionInput';
import { QuestionNavGrid } from './components/QuestionNavGrid';
import { ExamAttemptHeader } from './components/ExamAttemptHeader';

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
      <ExamAttemptHeader
        title={examQuery.data?.title ?? 'Làm bài thi'}
        currentIndex={currentIndex}
        total={total}
        answeredCount={answeredCount}
        remainingSeconds={remainingSeconds}
        showCalculator={showCalculator}
        onToggleCalculator={() => setShowCalculator((v) => !v)}
        isCurrentStarred={!!current && starred.has(current.questionId)}
        hasCurrentQuestion={!!current}
        onToggleStar={() => current && toggleStar(current.questionId)}
      />

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

      <QuestionNavGrid
        questions={questions}
        sections={sections}
        currentIndex={currentIndex}
        answers={answers}
        starred={starred}
        onSelect={setCurrentIndex}
      />

      {showCalculator && (
        <div className="fixed bottom-6 right-6 z-50">
          <Calculator onClose={() => setShowCalculator(false)} />
        </div>
      )}
    </div>
  );
}
