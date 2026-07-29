import type { ContentStatus, Question, QuestionType } from '../../../types/api';

export const PAGE_LIMIT = 20;

export const TABS: { value: ContentStatus | ''; label: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: '', label: 'Tất cả' },
];

export const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều lựa chọn',
  TRUE_FALSE: 'Đúng/sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};

export const SOURCE_LABEL: Record<Question['source'], { label: string; variant: 'indigo' | 'slate' | 'violet' }> = {
  IMPORTED_REAL: { label: 'Đề thi thật', variant: 'indigo' },
  ADMIN_MANUAL: { label: 'Admin soạn', variant: 'slate' },
  AI_GENERATED: { label: 'AI sinh', variant: 'violet' },
};
