import { apiClient } from '../../lib/api-client';
import type { StudyRoadmap, WeaknessAnalysis } from '../../types/api';

export async function fetchMyWeaknesses(subjectId?: string): Promise<WeaknessAnalysis[]> {
  const { data } = await apiClient.get<WeaknessAnalysis[]>('/roadmap/me/weaknesses', {
    params: subjectId ? { subjectId } : undefined,
  });
  return data;
}

export async function fetchMyRoadmap(subjectId?: string): Promise<StudyRoadmap[]> {
  const { data } = await apiClient.get<StudyRoadmap[]>('/roadmap/me/study-roadmap', {
    params: subjectId ? { subjectId } : undefined,
  });
  return data;
}
