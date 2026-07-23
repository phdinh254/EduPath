import { apiClient } from '../../lib/api-client';
import type { DgnlTemplate } from '../../types/api';

export interface DgnlTemplateSectionPayload {
  name: string;
  subjectId: string;
  questionCount: number;
  maxScore: number;
}

export async function fetchDgnlTemplates(): Promise<DgnlTemplate[]> {
  const { data } = await apiClient.get<DgnlTemplate[]>('/dgnl-templates');
  return data;
}

export async function createDgnlTemplate(payload: {
  name: string;
  sections: DgnlTemplateSectionPayload[];
}): Promise<DgnlTemplate> {
  const { data } = await apiClient.post<DgnlTemplate>('/dgnl-templates', payload);
  return data;
}

export async function deleteDgnlTemplate(id: string): Promise<void> {
  await apiClient.delete(`/dgnl-templates/${id}`);
}
