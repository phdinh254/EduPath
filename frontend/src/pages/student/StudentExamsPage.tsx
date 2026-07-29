import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExams } from '../../features/exams/examsApi';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { BookIcon } from '../../components/ui/Icons';
import type { ExamCategory } from '../../types/api';
import { ExamCard } from './components/ExamCard';
import { ExamFilterSidebar } from './components/ExamFilterSidebar';
import { SubjectGrid } from './components/SubjectGrid';
import { useFilteredExams } from './hooks/useFilteredExams';
import {
  CATEGORY_BANNER,
  SORT_LABEL,
  type DurationFilter,
  type SortMode,
  type StatusFilter,
} from './components/examBrowseConstants';

export function StudentExamsPage() {
  const [category, setCategory] = useState<ExamCategory>('THPT');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [likedOnly, setLikedOnly] = useState(false);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');

  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));
  const { examsInCategory, visibleExams, subjectCounts } = useFilteredExams({
    exams: examsQuery.data,
    category,
    selectedSubjectId,
    statusFilter,
    likedOnly,
    durationFilter,
    search,
    sort,
  });

  const subjectsWithCounts = useMemo(
    () =>
      (subjectsQuery.data ?? [])
        .map((s) => ({ subject: s, count: subjectCounts.get(s.id) ?? 0 }))
        .filter((s) => s.count > 0),
    [subjectsQuery.data, subjectCounts],
  );

  const totalAttempts = examsInCategory.reduce((sum, e) => sum + e.attemptCount, 0);
  const banner = CATEGORY_BANNER[category];
  const hasActiveFilters = statusFilter !== 'all' || likedOnly || durationFilter !== 'all';

  function handleSelectCategory(next: ExamCategory) {
    setCategory(next);
    setSelectedSubjectId(null);
    setSearch('');
  }

  function resetFilters() {
    setStatusFilter('all');
    setLikedOnly(false);
    setDurationFilter('all');
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <ExamFilterSidebar
        category={category}
        onSelectCategory={handleSelectCategory}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        durationFilter={durationFilter}
        onDurationFilterChange={setDurationFilter}
        likedOnly={likedOnly}
        onLikedOnlyChange={setLikedOnly}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      />

      <div>
        {/* Banner nhóm thi */}
        <div
          className={`mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r p-5 text-white shadow-md ${banner.gradient}`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <BookIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-bold">{banner.label}</p>
            <p className="text-sm text-white/80">
              {totalAttempts.toLocaleString('vi-VN')} lượt làm · {examsInCategory.length} bài test
            </p>
          </div>
        </div>

        {examsQuery.isLoading && <LoadingState />}
        {examsQuery.error && <ErrorState message={getApiErrorMessage(examsQuery.error)} />}

        {category === 'THPT' && subjectsWithCounts.length > 0 && (
          <SubjectGrid
            title={banner.label}
            totalCount={examsInCategory.length}
            subjectsWithCounts={subjectsWithCounts}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={setSelectedSubjectId}
          />
        )}

        {/* Tìm kiếm/sắp xếp + lưới đề thi */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài tập..."
            className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/20"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {Object.entries(SORT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {!examsQuery.isLoading && visibleExams.length === 0 && (
          <EmptyState label="Không tìm thấy đề thi phù hợp." />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleExams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              subjectName={exam.subjectId ? (subjectNameById.get(exam.subjectId) ?? 'Môn học') : 'Nhiều môn (ĐGNL)'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
