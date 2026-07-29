import { gradeEssayFallback } from './grading.utils';

describe('gradeEssayFallback', () => {
  it('chấm 0 điểm ngay nếu học sinh không nộp gì, không cần ADMIN xác nhận', () => {
    const result = gradeEssayFallback({ text: '   ' }, 'GEMINI_NOT_CONFIGURED');
    expect(result).toEqual({
      status: 'GRADED',
      score: 0,
      comment: 'Học sinh chưa nộp bài viết.',
    });
  });

  it('chuyển sang chờ ADMIN chấm tay nếu có nội dung nhưng Gemini chưa cấu hình', () => {
    const result = gradeEssayFallback(
      { text: 'Bài làm của học sinh về tác phẩm Vợ nhặt...' },
      'GEMINI_NOT_CONFIGURED',
    );
    expect(result.status).toBe('PENDING_REVIEW');
    if (result.status === 'PENDING_REVIEW') {
      expect(result.reason).toBe('GEMINI_NOT_CONFIGURED');
    }
  });

  it('chuyển sang chờ ADMIN chấm tay nếu Gemini gọi lỗi giữa chừng', () => {
    const result = gradeEssayFallback(
      { text: 'Một bài văn khá dài về chủ đề đã cho.' },
      'GEMINI_ERROR',
    );
    expect(result.status).toBe('PENDING_REVIEW');
    if (result.status === 'PENDING_REVIEW') {
      expect(result.reason).toBe('GEMINI_ERROR');
    }
  });

  it('không bao giờ tự tính điểm dựa trên số từ khi có nội dung', () => {
    const shortEssay = gradeEssayFallback({ text: 'Ngắn.' }, 'GEMINI_ERROR');
    const longEssay = gradeEssayFallback(
      { text: 'từ '.repeat(500) },
      'GEMINI_ERROR',
    );
    expect(shortEssay.status).toBe('PENDING_REVIEW');
    expect(longEssay.status).toBe('PENDING_REVIEW');
  });
});
