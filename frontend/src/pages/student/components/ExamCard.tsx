import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toggleExamLike } from '../../../features/exams/examsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { Card } from '../../../components/ui/Card';
import { ClockIcon, FileTextIcon } from '../../../components/ui/Icons';
import type { Exam } from '../../../types/api';
import { accentFor } from './examBrowseConstants';

function ExamCover({ exam, accent }: { exam: Exam; accent: string }) {
  return (
    <div className={`relative flex h-28 items-center justify-center rounded-t-2xl bg-gradient-to-br p-4 ${accent}`}>
      <FileTextIcon className="absolute -bottom-3 -right-3 h-20 w-20 text-white/15" />
      <p className="line-clamp-3 text-center text-sm font-semibold text-white drop-shadow">{exam.title}</p>
    </div>
  );
}

function LikeButton({ exam }: { exam: Exam }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () => toggleExamLike(exam.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      title={exam.liked ? 'Bỏ thích' : 'Thích đề này'}
      className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition ${
        exam.liked ? 'bg-white text-rose-500' : 'bg-black/25 text-white hover:bg-black/40'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={exam.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}

export function ExamCard({ exam, subjectName }: { exam: Exam; subjectName: string }) {
  const navigate = useNavigate();
  return (
    <Card className="flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative">
        <ExamCover exam={exam} accent={accentFor(exam.subjectId ?? exam.id)} />
        <LikeButton exam={exam} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {exam.category === 'DGNL' ? 'ĐGNL' : 'Tham khảo'} · {new Date(exam.createdAt).getFullYear()}
        </p>
        <p className="line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">{exam.title}</p>
        <p className="text-xs text-slate-500">
          {subjectName} · {exam.durationMinutes} phút
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {exam.attemptCount} lượt làm
          </span>
          <span className="inline-flex items-center gap-1">❤ {exam.likeCount}</span>
          {exam.avgScore != null && <span className="inline-flex items-center gap-1">⭐ TB {exam.avgScore}</span>}
        </div>
        <button
          onClick={() => navigate(`/student/exams/${exam.id}/attempt`)}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-violet-500"
        >
          ▶ Làm bài
        </button>
      </div>
    </Card>
  );
}
