import type { Subject } from '../../../types/api';
import { BookIcon, LayersIcon } from '../../../components/ui/Icons';
import { ACCENTS } from './examBrowseConstants';

interface SubjectGridProps {
  title: string;
  totalCount: number;
  subjectsWithCounts: { subject: Subject; count: number }[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string | null) => void;
}

// Tầng 2 của trang khám phá đề (chỉ THPT — ĐGNL không có khái niệm nhóm theo
// môn) — lưới chọn nhanh môn học kèm số lượng đề.
export function SubjectGrid({
  title,
  totalCount,
  subjectsWithCounts,
  selectedSubjectId,
  onSelectSubject,
}: SubjectGridProps) {
  return (
    <div className="mb-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Ôn thi {title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          onClick={() => onSelectSubject(null)}
          className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm transition ${
            selectedSubjectId === null
              ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10'
              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white">
            <LayersIcon className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-100">Tất cả môn</span>
            <span className="text-xs text-slate-400">{totalCount}+ Bài test</span>
          </span>
        </button>
        {subjectsWithCounts.map(({ subject, count }, i) => (
          <button
            key={subject.id}
            onClick={() => onSelectSubject(subject.id)}
            className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm transition ${
              selectedSubjectId === subject.id
                ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900'
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${ACCENTS[i % ACCENTS.length]}`}
            >
              <BookIcon className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">{subject.name}</span>
              <span className="text-xs text-slate-400">{count}+ Bài test</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
