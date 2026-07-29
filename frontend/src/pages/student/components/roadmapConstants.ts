import type { ExamCategory } from '../../../types/api';

export const STAGE_LABEL: Record<string, string> = {
  REVIEW_THEORY: 'Ôn lý thuyết nền tảng',
  BASIC_PRACTICE: 'Làm bài cơ bản',
  ADVANCED_PRACTICE: 'Luyện bài vận dụng',
  RETEST: 'Kiểm tra lại',
};

// Thang điểm tối đa theo loại đề — dùng để chuẩn hoá điểm THPT (10) và ĐGNL
// (150) về cùng thang % khi vẽ chung một biểu đồ xu hướng.
export const MAX_SCORE_BY_CATEGORY: Record<ExamCategory, number> = { THPT: 10, DGNL: 150 };
