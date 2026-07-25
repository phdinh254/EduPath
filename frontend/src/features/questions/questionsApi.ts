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

export interface GenerateQuestionsPayload {
  subjectId: string;
  topicId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  count: number;
}

export async function fetchQuestions(status?: ContentStatus): Promise<Question[]> {
  const { data } = await apiClient.get<Question[]>('/questions', { params: status ? { status } : undefined });
  return data;
}

export async function createQuestion(payload: CreateQuestionPayload): Promise<Question> {
  const { data } = await apiClient.post<Question>('/questions', payload);
  return data;
}

// AI sinh một lô câu hỏi mới, vào hàng chờ PENDING_APPROVAL chờ ADMIN duyệt.
export async function generateQuestions(payload: GenerateQuestionsPayload): Promise<Question[]> {
  const { data } = await apiClient.post<Question[]>('/questions/generate', payload);
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

export interface ParsedImportQuestion {
  content: string;
  type: QuestionType;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  suggestedTopicName: string;
  suggestedDifficulty: DifficultyLevel;
}

// Bước 1: AI tách văn bản thô đề thi thật thành câu hỏi có cấu trúc — chỉ
// trả về bản nháp, KHÔNG lưu vào kho.
export async function parseExamImport(subjectId: string, rawText: string): Promise<ParsedImportQuestion[]> {
  const { data } = await apiClient.post<ParsedImportQuestion[]>('/questions/import/parse', {
    subjectId,
    rawText,
  });
  return data;
}

export interface CommitImportedQuestionItem {
  topicId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  content: string;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: string;
}

// Bước 2: ghi các câu hỏi đã ADMIN rà soát vào kho dùng chung (APPROVED, source=IMPORTED_REAL).
export async function commitImportedQuestions(
  subjectId: string,
  questions: CommitImportedQuestionItem[],
): Promise<{ count: number }> {
  const { data } = await apiClient.post<{ count: number }>('/questions/import/commit', {
    subjectId,
    questions,
  });
  return data;
}
