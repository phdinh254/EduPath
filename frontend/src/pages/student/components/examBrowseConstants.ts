import type { ExamCategory } from '../../../types/api';

export const CATEGORY_TABS: { value: ExamCategory; label: string }[] = [
  { value: 'THPT', label: 'Ôn thi tốt nghiệp THPT' },
  { value: 'DGNL', label: 'ĐGNL & ĐGTD' },
];

export const CATEGORY_BANNER: Record<ExamCategory, { label: string; gradient: string }> = {
  THPT: { label: 'Ôn thi tốt nghiệp THPT', gradient: 'from-rose-500 to-orange-500' },
  DGNL: { label: 'Đánh giá năng lực & tư duy', gradient: 'from-sky-500 to-blue-600' },
};

export const ACCENTS = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
];

export function accentFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export type SortMode = 'newest' | 'popular' | 'topScore';

export const SORT_LABEL: Record<SortMode, string> = {
  newest: 'Mới nhất',
  popular: 'Nhiều lượt làm nhất',
  topScore: 'Điểm TB cao nhất',
};

export type StatusFilter = 'all' | 'notStarted' | 'done';

export const STATUS_FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'notStarted', label: 'Chưa làm' },
  { value: 'done', label: 'Đã làm' },
];

export type DurationFilter = 'all' | 'short' | 'medium' | 'long';

export const DURATION_FILTER_TABS: { value: DurationFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'short', label: 'Dưới 30 phút' },
  { value: 'medium', label: '30–60 phút' },
  { value: 'long', label: 'Trên 60 phút' },
];

export function matchesDuration(minutes: number, filter: DurationFilter): boolean {
  if (filter === 'short') return minutes < 30;
  if (filter === 'medium') return minutes >= 30 && minutes <= 60;
  if (filter === 'long') return minutes > 60;
  return true;
}
