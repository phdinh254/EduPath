import { apiClient } from '../../lib/api-client';
import type { ContentStatus, DifficultyLevel, Question, QuestionType } from '../../types/api';

export interface CreateQuestionPayload {
  subjectId: string;
  topicId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  content: string;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: string;
}

export async function fetchQuestions(status?: ContentStatus): Promise<Question[]> {
  const { data } = await apiClient.get<Question[]>('/questions', { params: status ? { status } : undefined });
  return data;
}

export async function createQuestion(payload: CreateQuestionPayload): Promise<Question> {
  const { data } = await apiClient.post<Question>('/questions', payload);
  return data;
}

export async function proposeQuestion(id: string): Promise<Question> {
  const { data } = await apiClient.post<Question>(`/questions/${id}/propose`);
  return data;
}

export async function approveQuestion(id: string): Promise<Question> {
  const { data } = await apiClient.post<Question>(`/questions/${id}/approve`);
  return data;
}

export async function rejectQuestion(id: string, reason?: string): Promise<Question> {
  const { data } = await apiClient.post<Question>(`/questions/${id}/reject`, { reason });
  return data;
}
