import { apiClient } from '../../lib/api-client';

export interface ReadinessResult {
  subjectId: string;
  readinessScore: number;
  breakdown: {
    score: number;
    coverage: number;
    mastery: number;
    consistency: number;
  };
  predictedScoreRange: { low: number; high: number } | null;
  aiNote: string;
}

export interface MyReadiness {
  overallScore: number | null;
  subjects: ReadinessResult[];
}

export async function fetchMyReadiness(): Promise<MyReadiness> {
  const { data } = await apiClient.get<MyReadiness>('/readiness/me');
  return data;
}

export interface ReadinessHistoryPoint {
  dateKey: string;
  readinessScore: number;
}

export async function fetchReadinessHistory(subjectId: string): Promise<ReadinessHistoryPoint[]> {
  const { data } = await apiClient.get<ReadinessHistoryPoint[]>('/readiness/me/history', {
    params: { subjectId },
  });
  return data;
}
