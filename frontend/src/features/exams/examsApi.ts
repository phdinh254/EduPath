import { apiClient } from '../../lib/api-client';
import type { AttemptReviewItem, Exam, ExamAttempt, ExamCategory, ExamQuestion } from '../../types/api';

export async function fetchExams(): Promise<Exam[]> {
  const { data } = await apiClient.get<Exam[]>('/exams');
  return data;
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
  // ĐGNL
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

export async function fetchExamAttempts(examId: string): Promise<ExamAttempt[]> {
  const { data } = await apiClient.get<ExamAttempt[]>(`/exams/${examId}/attempts`);
  return data;
}

export async function startAttempt(examId: string): Promise<ExamAttempt> {
  const { data } = await apiClient.post<ExamAttempt>(`/exams/${examId}/attempts`);
  return data;
}

export async function saveAnswer(attemptId: string, questionId: string, response: unknown): Promise<void> {
  await apiClient.post(`/exams/attempts/${attemptId}/answers`, { questionId, response });
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
