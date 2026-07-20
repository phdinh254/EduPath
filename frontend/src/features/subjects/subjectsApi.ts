import { apiClient } from '../../lib/api-client';
import type { Subject, Topic } from '../../types/api';

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
