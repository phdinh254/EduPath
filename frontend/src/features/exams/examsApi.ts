import { apiClient } from '../../lib/api-client';
import type {
  AttemptReviewItem,
  Exam,
  ExamAttempt,
  ExamCategory,
  ExamQuestion,
  PaginatedResult,
} from '../../types/api';

// Backend giờ trả về có phân trang (bảo vệ khỏi query không giới hạn) — trang
// khám phá đề hiện lọc/sắp xếp phía client trên toàn bộ danh mục nên vẫn xin
// trang lớn nhất cho phép (100) thay vì UI phân trang thật; tách trang thật
// (chuyển bộ lọc lên server) là việc riêng ngoài phạm vi hiện tại.
export async function fetchExams(): Promise<Exam[]> {
  const { data } = await apiClient.get<PaginatedResult<Exam>>('/exams', {
    params: { limit: 100 },
  });
  return data.data;
}

export async function fetchExam(examId: string): Promise<Exam> {
  const { data } = await apiClient.get<Exam>(`/exams/${examId}`);
  return data;
}

export async function createExam(payload: {
  title: string;
  category?: ExamCategory;
  subjectId?: string;
  durationMinutes: number;
}): Promise<Exam> {
  const { data } = await apiClient.post<Exam>('/exams', payload);
  return data;
}

export interface GenerateExamSectionPayload {
  name: string;
  subjectId: string;
  questionCount: number;
  maxScore: number;
}

export interface GenerateExamPayload {
  title: string;
  category: ExamCategory;
  // Bỏ trống với THPT để dùng durationMinutes mặc định từ cấu trúc đề của
  // môn; bắt buộc với ĐGNL.
  durationMinutes?: number;
  // THPT: số câu theo dạng × mức độ khó lấy từ cấu trúc đề cố định của môn
  // (xem subjectsApi.fetchExamStructure/upsertExamStructure), không còn gửi
  // số lượng thủ công ở đây.
  subjectId?: string;
  // ĐGNL — chọn 1 trong 2: dùng mẫu đề có sẵn (dgnlTemplateId) hoặc tự khai
  // báo sections thủ công.
  dgnlTemplateId?: string;
  sections?: GenerateExamSectionPayload[];
}

// AI tự động ghép đề hoàn chỉnh — luồng chính để tạo đề, thay cho soạn thủ công.
export async function generateExam(payload: GenerateExamPayload): Promise<Exam> {
  const { data } = await apiClient.post<Exam>('/exams/generate', payload);
  return data;
}

export async function addExamQuestion(
  examId: string,
  payload: { questionId: string; order: number; maxScore: number; sectionId?: string },
): Promise<ExamQuestion> {
  const { data } = await apiClient.post<ExamQuestion>(`/exams/${examId}/questions`, payload);
  return data;
}

export async function fetchExamQuestions(examId: string): Promise<ExamQuestion[]> {
  const { data } = await apiClient.get<ExamQuestion[]>(`/exams/${examId}/questions`);
  return data;
}

// Học sinh tự tạo đề luyện tập nhanh cho một chuyên đề yếu — dùng từ nút
// "Luyện ngay" trên trang lộ trình AI.
export async function generateTopicPractice(topicId: string, questionCount?: number): Promise<Exam> {
  const { data } = await apiClient.post<Exam>('/exams/practice/topic', { topicId, questionCount });
  return data;
}

export async function fetchExamAttempts(examId: string): Promise<ExamAttempt[]> {
  const { data } = await apiClient.get<ExamAttempt[]>(`/exams/${examId}/attempts`);
  return data;
}

// Lịch sử làm bài của chính học sinh đang đăng nhập — dùng cho dashboard
// tiến độ ôn tập cá nhân.
export async function fetchMyAttempts(): Promise<ExamAttempt[]> {
  const { data } = await apiClient.get<ExamAttempt[]>('/exams/me/attempts');
  return data;
}

export async function startAttempt(examId: string): Promise<ExamAttempt> {
  const { data } = await apiClient.post<ExamAttempt>(`/exams/${examId}/attempts`);
  return data;
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  response: unknown,
  timeSpentSeconds?: number,
): Promise<void> {
  await apiClient.post(`/exams/attempts/${attemptId}/answers`, { questionId, response, timeSpentSeconds });
}

// Chỉ gửi thời gian vừa dừng ở câu này (không kèm response) — dùng khi học
// sinh chuyển câu mà không thay đổi câu trả lời, để vẫn ghi nhận thời gian
// làm bài phục vụ phân tích điểm yếu theo AI.
export async function saveAnswerTime(attemptId: string, questionId: string, timeSpentSeconds: number): Promise<void> {
  await apiClient.post(`/exams/attempts/${attemptId}/answers`, { questionId, timeSpentSeconds });
}

export async function fetchAttempt(attemptId: string): Promise<ExamAttempt> {
  const { data } = await apiClient.get<ExamAttempt>(`/exams/attempts/${attemptId}`);
  return data;
}

export async function fetchAttemptReview(attemptId: string): Promise<AttemptReviewItem[]> {
  const { data } = await apiClient.get<AttemptReviewItem[]>(`/exams/attempts/${attemptId}/review`);
  return data;
}

export async function toggleExamLike(examId: string): Promise<{ liked: boolean; likeCount: number }> {
  const { data } = await apiClient.post<{ liked: boolean; likeCount: number }>(`/exams/${examId}/like`);
  return data;
}

// Đề tạo thủ công (POST /exams) bắt đầu ở DRAFT — gọi sau khi đã thêm đủ câu
// hỏi để học sinh bắt đầu thấy đề.
export async function publishExam(examId: string): Promise<Exam> {
  const { data } = await apiClient.post<Exam>(`/exams/${examId}/publish`);
  return data;
}

// Rút đề khỏi danh sách khám phá — lịch sử làm bài cũ vẫn giữ nguyên.
export async function archiveExam(examId: string): Promise<Exam> {
  const { data } = await apiClient.post<Exam>(`/exams/${examId}/archive`);
  return data;
}
