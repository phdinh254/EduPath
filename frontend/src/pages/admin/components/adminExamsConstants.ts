import type { DifficultyLevel, ExamCategory, ExamPublishStatus, QuestionType } from '../../../types/api';

export const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều lựa chọn',
  TRUE_FALSE: 'Đúng/sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  KNOWLEDGE: 'Nhận biết',
  COMPREHENSION: 'Thông hiểu',
  APPLICATION: 'Vận dụng',
  HIGH_APPLICATION: 'Vận dụng cao',
};

export const CATEGORY_LABEL: Record<ExamCategory, string> = {
  THPT: 'THPT quốc gia',
  DGNL: 'Đánh giá năng lực',
};

export const STATUS_BADGE: Record<ExamPublishStatus, { label: string; variant: 'amber' | 'emerald' | 'slate' }> = {
  DRAFT: { label: 'Nháp', variant: 'amber' },
  PUBLISHED: { label: 'Đã công bố', variant: 'emerald' },
  ARCHIVED: { label: 'Đã lưu trữ', variant: 'slate' },
};
