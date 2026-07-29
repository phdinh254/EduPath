import { useMemo } from 'react';
import type { Exam, ExamCategory } from '../../../types/api';
import {
  matchesDuration,
  type DurationFilter,
  type SortMode,
  type StatusFilter,
} from '../components/examBrowseConstants';

interface UseFilteredExamsParams {
  exams: Exam[] | undefined;
  category: ExamCategory;
  selectedSubjectId: string | null;
  statusFilter: StatusFilter;
  likedOnly: boolean;
  durationFilter: DurationFilter;
  search: string;
  sort: SortMode;
}

// Toàn bộ logic lọc/sắp xếp đề thi phía client cho trang khám phá đề — tách
// khỏi StudentExamsPage để component chính chỉ còn lo bố cục/render.
export function useFilteredExams({
  exams,
  category,
  selectedSubjectId,
  statusFilter,
  likedOnly,
  durationFilter,
  search,
  sort,
}: UseFilteredExamsParams) {
  const examsInCategory = useMemo(
    () =>
      (exams ?? [])
        // Đề luyện tập cá nhân (nút "Luyện ngay" ở trang Lộ trình) chỉ dùng
        // một lần, không phải nội dung để khám phá/tái sử dụng — không hiện
        // ở đây dù backend vẫn trả về (học sinh có quyền xem đề của chính mình).
        .filter((e) => e.category === category && e.purpose !== 'PERSONAL_PRACTICE')
        .map((e) => ({
          ...e,
          attemptCount: e.attemptCount ?? 0,
          likeCount: e.likeCount ?? 0,
          liked: e.liked ?? false,
          avgScore: e.avgScore ?? null,
        })),
    [exams, category],
  );

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

  const subjectCounts = useMemo(() => {
    if (category !== 'THPT') return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const exam of examsInCategory) {
      if (!exam.subjectId) continue;
      counts.set(exam.subjectId, (counts.get(exam.subjectId) ?? 0) + 1);
    }
    return counts;
  }, [category, examsInCategory]);

  return { examsInCategory, visibleExams, subjectCounts };
}
