import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchExams, toggleExamLike } from '../../features/exams/examsApi';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Card } from '../../components/ui/Card';
import { BookIcon, ClockIcon, FileTextIcon, LayersIcon } from '../../components/ui/Icons';
import type { Exam, ExamCategory } from '../../types/api';

const CATEGORY_TABS: { value: ExamCategory; label: string }[] = [
  { value: 'THPT', label: 'Ôn thi tốt nghiệp THPT' },
  { value: 'DGNL', label: 'ĐGNL & ĐGTD' },
];

const CATEGORY_BANNER: Record<ExamCategory, { label: string; gradient: string }> = {
  THPT: { label: 'Ôn thi tốt nghiệp THPT', gradient: 'from-rose-500 to-orange-500' },
  DGNL: { label: 'Đánh giá năng lực & tư duy', gradient: 'from-sky-500 to-blue-600' },
};

const ACCENTS = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
];

function accentFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

type SortMode = 'newest' | 'popular' | 'topScore';

const SORT_LABEL: Record<SortMode, string> = {
  newest: 'Mới nhất',
  popular: 'Nhiều lượt làm nhất',
  topScore: 'Điểm TB cao nhất',
};

type StatusFilter = 'all' | 'notStarted' | 'done';

const STATUS_FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'notStarted', label: 'Chưa làm' },
  { value: 'done', label: 'Đã làm' },
];

type DurationFilter = 'all' | 'short' | 'medium' | 'long';

const DURATION_FILTER_TABS: { value: DurationFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'short', label: 'Dưới 30 phút' },
  { value: 'medium', label: '30–60 phút' },
  { value: 'long', label: 'Trên 60 phút' },
];

function matchesDuration(minutes: number, filter: DurationFilter): boolean {
  if (filter === 'short') return minutes < 30;
  if (filter === 'medium') return minutes >= 30 && minutes <= 60;
  if (filter === 'long') return minutes > 60;
  return true;
}

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

function ExamCard({ exam, subjectName }: { exam: Exam; subjectName: string }) {
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
          <span className="inline-flex items-center gap-1">
            ❤ {exam.likeCount}
          </span>
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
  const examsInCategory = useMemo(
    () =>
      (examsQuery.data ?? [])
        .filter((e) => e.category === category)
        .map((e) => ({
          ...e,
          attemptCount: e.attemptCount ?? 0,
          likeCount: e.likeCount ?? 0,
          liked: e.liked ?? false,
          avgScore: e.avgScore ?? null,
        })),
    [examsQuery.data, category],
  );

  const subjectsWithCounts = useMemo(() => {
    if (category !== 'THPT') return [];
    const counts = new Map<string, number>();
    for (const exam of examsInCategory) {
      if (!exam.subjectId) continue;
      counts.set(exam.subjectId, (counts.get(exam.subjectId) ?? 0) + 1);
    }
    return (subjectsQuery.data ?? [])
      .map((s) => ({ subject: s, count: counts.get(s.id) ?? 0 }))
      .filter((s) => s.count > 0);
  }, [category, examsInCategory, subjectsQuery.data]);

  const visibleExams = useMemo(() => {
    let list = examsInCategory;
    if (category === 'THPT' && selectedSubjectId) {
      list = list.filter((e) => e.subjectId === selectedSubjectId);
    }
    if (statusFilter === 'notStarted') list = list.filter((e) => e.attemptCount === 0);
    else if (statusFilter === 'done') list = list.filter((e) => e.attemptCount > 0);
    if (likedOnly) list = list.filter((e) => e.liked);
    if (durationFilter !== 'all') list = list.filter((e) => matchesDuration(e.durationMinutes, durationFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === 'popular') sorted.sort((a, b) => b.attemptCount - a.attemptCount);
    else if (sort === 'topScore') sorted.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
    else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [examsInCategory, category, selectedSubjectId, statusFilter, likedOnly, durationFilter, search, sort]);

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
      {/* Tầng 1: chọn nhóm thi (cuộn cùng trang) + bộ lọc (cố định khi cuộn).
          Không dùng self-start ở đây — aside cần cao bằng cột phải để bộ lọc
          sticky bên trong còn "chỗ" mà bám theo suốt khi cuộn. */}
      <aside className="space-y-6">
        <div className="space-y-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleSelectCategory(tab.value)}
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
              <button onClick={resetFilters} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
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
                  onClick={() => setStatusFilter(tab.value)}
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
                  onClick={() => setDurationFilter(tab.value)}
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
              onChange={(e) => setLikedOnly(e.target.checked)}
            />
            Chỉ hiện đề đã thích
          </label>
        </div>
      </aside>

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

        {/* Tầng 2: lưới môn học (chỉ THPT — ĐGNL không có khái niệm nhóm theo trường) */}
        {category === 'THPT' && subjectsWithCounts.length > 0 && (
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ôn thi {banner.label}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                onClick={() => setSelectedSubjectId(null)}
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
                  <span className="text-xs text-slate-400">{examsInCategory.length}+ Bài test</span>
                </span>
              </button>
              {subjectsWithCounts.map(({ subject, count }, i) => (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubjectId(subject.id)}
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
        )}

        {/* Tầng 3: tìm kiếm/sắp xếp + lưới đề thi */}
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
              subjectName={
                exam.subjectId ? (subjectNameById.get(exam.subjectId) ?? 'Môn học') : 'Nhiều môn (ĐGNL)'
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
