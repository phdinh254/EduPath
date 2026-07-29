import { apiClient } from '../../lib/api-client';
import type { AiGradingDeviationStats, ExamAttempt, PendingReviewAnswer } from '../../types/api';

export async function submitAttempt(attemptId: string): Promise<ExamAttempt> {
  const { data } = await apiClient.post<ExamAttempt>(`/grading/attempts/${attemptId}/submit`);
  return data;
}

export async function fetchPendingReview(): Promise<PendingReviewAnswer[]> {
  const { data } = await apiClient.get<PendingReviewAnswer[]>('/grading/pending-review');
  return data;
}

export async function reviewEssayAnswer(
  answerId: string,
  payload: { finalScore: number; comment?: string },
): Promise<ExamAttempt> {
  const { data } = await apiClient.post<ExamAttempt>(`/grading/answers/${answerId}/review`, payload);
  return data;
}

export async function explainWrongAnswer(answerId: string): Promise<{ aiExplanation: string }> {
  const { data } = await apiClient.post<{ aiExplanation: string }>(`/grading/answers/${answerId}/explain`);
  return data;
}

export async function fetchAiQualityStats(): Promise<AiGradingDeviationStats> {
  const { data } = await apiClient.get<AiGradingDeviationStats>('/grading/ai-quality-stats');
  return data;
}
