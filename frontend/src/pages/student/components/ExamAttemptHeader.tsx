import { useNavigate } from 'react-router-dom';
import { CalculatorIcon, ClockIcon, StarIcon, XIcon } from '../../../components/ui/Icons';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface ExamAttemptHeaderProps {
  title: string;
  currentIndex: number;
  total: number;
  answeredCount: number;
  remainingSeconds: number | null;
  showCalculator: boolean;
  onToggleCalculator: () => void;
  isCurrentStarred: boolean;
  hasCurrentQuestion: boolean;
  onToggleStar: () => void;
}

// Thanh trên cùng của trang làm bài: thoát, tiêu đề, đồng hồ đếm ngược, bật
// máy tính, đánh dấu yêu thích câu hiện tại.
export function ExamAttemptHeader({
  title,
  currentIndex,
  total,
  answeredCount,
  remainingSeconds,
  showCalculator,
  onToggleCalculator,
  isCurrentStarred,
  hasCurrentQuestion,
  onToggleStar,
}: ExamAttemptHeaderProps) {
  const navigate = useNavigate();

  return (
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
          <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
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
          onClick={onToggleCalculator}
          title="Máy tính"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
            showCalculator
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CalculatorIcon className="h-5 w-5" />
        </button>
        {hasCurrentQuestion && (
          <button
            onClick={onToggleStar}
            title="Đánh dấu câu này để xem lại"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              isCurrentStarred ? 'text-amber-500' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <StarIcon className="h-5 w-5" fill={isCurrentStarred ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    </div>
  );
}
