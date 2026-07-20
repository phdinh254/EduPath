import { apiClient } from '../../lib/api-client';
import type { AttemptReviewItem, Exam, ExamAttempt, ExamQuestion } from '../../types/api';

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
  subjectId: string;
  durationMinutes: number;
  classId?: string;
}): Promise<Exam> {
  const { data } = await apiClient.post<Exam>('/exams', payload);
  return data;
}

export async function addExamQuestion(
  examId: string,
  payload: { questionId: string; order: number; maxScore: number },
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
