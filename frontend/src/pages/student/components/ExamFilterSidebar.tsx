import type { ExamCategory } from '../../../types/api';
import {
  CATEGORY_TABS,
  DURATION_FILTER_TABS,
  STATUS_FILTER_TABS,
  type DurationFilter,
  type StatusFilter,
} from './examBrowseConstants';

interface ExamFilterSidebarProps {
  category: ExamCategory;
  onSelectCategory: (next: ExamCategory) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (next: StatusFilter) => void;
  durationFilter: DurationFilter;
  onDurationFilterChange: (next: DurationFilter) => void;
  likedOnly: boolean;
  onLikedOnlyChange: (next: boolean) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

// Tầng 1 của trang khám phá đề: chọn nhóm thi (cuộn cùng trang) + bộ lọc (cố
// định khi cuộn) — tách khỏi StudentExamsPage để trang chính chỉ còn lo dữ
// liệu/composition.
export function ExamFilterSidebar({
  category,
  onSelectCategory,
  statusFilter,
  onStatusFilterChange,
  durationFilter,
  onDurationFilterChange,
  likedOnly,
  onLikedOnlyChange,
  hasActiveFilters,
  onResetFilters,
}: ExamFilterSidebarProps) {
  return (
    <aside className="space-y-6">
      <div className="space-y-2">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onSelectCategory(tab.value)}
            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
              category === tab.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
            }`}
          >
            {tab.label}
            <span>›</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bộ lọc</p>
          {hasActiveFilters && (
            <button onClick={onResetFilters} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Xoá lọc
            </button>
          )}
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Trạng thái làm bài</p>
          <div className="flex flex-col gap-1">
            {STATUS_FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onStatusFilterChange(tab.value)}
                className={`rounded-xl px-3 py-1.5 text-left text-sm transition ${
                  statusFilter === tab.value
                    ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Thời lượng</p>
          <div className="flex flex-col gap-1">
            {DURATION_FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onDurationFilterChange(tab.value)}
                className={`rounded-xl px-3 py-1.5 text-left text-sm transition ${
                  durationFilter === tab.value
                    ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={likedOnly}
            onChange={(e) => onLikedOnlyChange(e.target.checked)}
          />
          Chỉ hiện đề đã thích
        </label>
      </div>
    </aside>
  );
}
