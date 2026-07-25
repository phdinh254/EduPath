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
