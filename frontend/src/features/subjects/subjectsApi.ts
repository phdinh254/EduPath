import { apiClient } from '../../lib/api-client';
import type { DifficultyLevel, ExamStructure, QuestionType, Subject, Topic } from '../../types/api';

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await apiClient.get<Subject[]>('/subjects');
  return data;
}

export async function fetchTopics(subjectId: string): Promise<Topic[]> {
  const { data } = await apiClient.get<Topic[]>(`/subjects/${subjectId}/topics`);
  return data;
}

export async function createSubject(payload: { code: string; name: string }): Promise<Subject> {
  const { data } = await apiClient.post<Subject>('/subjects', payload);
  return data;
}

export async function createTopic(subjectId: string, payload: { name: string; parentTopicId?: string }): Promise<Topic> {
  const { data } = await apiClient.post<Topic>(`/subjects/${subjectId}/topics`, payload);
  return data;
}

export async function fetchExamStructure(subjectId: string): Promise<ExamStructure | null> {
  // Môn chưa cấu hình: backend trả về body rỗng (không phải JSON "null"),
  // axios parse thành chuỗi rỗng — chuẩn hoá về null cho phía gọi.
  const { data } = await apiClient.get<ExamStructure | null | ''>(`/subjects/${subjectId}/exam-structure`);
  return data || null;
}

export interface ExamStructureItemPayload {
  type: QuestionType;
  difficulty: DifficultyLevel;
  questionCount: number;
  maxScorePerQuestion: number;
}

export async function upsertExamStructure(
  subjectId: string,
  payload: { durationMinutes: number; items: ExamStructureItemPayload[] },
): Promise<ExamStructure> {
  const { data } = await apiClient.put<ExamStructure>(`/subjects/${subjectId}/exam-structure`, payload);
  return data;
}
