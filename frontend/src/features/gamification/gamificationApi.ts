import { apiClient } from '../../lib/api-client';
import type { Badge, StreakInfo } from '../../types/api';

export async function fetchMyStreak(): Promise<StreakInfo> {
  const { data } = await apiClient.get<StreakInfo>('/gamification/me/streak');
  return data;
}

export async function fetchMyBadges(): Promise<Badge[]> {
  const { data } = await apiClient.get<Badge[]>('/gamification/me/badges');
  return data;
}
