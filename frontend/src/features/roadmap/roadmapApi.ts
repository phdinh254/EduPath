import { apiClient } from '../../lib/api-client';
import type { StudyRoadmap, StudyRoadmapStage, WeaknessAnalysis } from '../../types/api';

export async function fetchMyWeaknesses(subjectId?: string): Promise<WeaknessAnalysis[]> {
  const { data } = await apiClient.get<WeaknessAnalysis[]>('/roadmap/me/weaknesses', {
    params: subjectId ? { subjectId } : undefined,
  });
  return data;
}

export async function fetchMyRoadmap(
  subjectId?: string,
  status?: StudyRoadmap['status'],
): Promise<StudyRoadmap[]> {
  const { data } = await apiClient.get<StudyRoadmap[]>('/roadmap/me/study-roadmap', {
    params: { subjectId, status },
  });
  return data;
}

export async function completeRoadmapStage(
  roadmapId: string,
  topicId: string,
  stage: StudyRoadmapStage['stage'],
): Promise<StudyRoadmap> {
  const { data } = await apiClient.patch<StudyRoadmap>('/roadmap/me/stages', {
    roadmapId,
    topicId,
    stage,
  });
  return data;
}
