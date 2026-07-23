import { apiClient } from '../../lib/api-client';
import type { StudentNotification } from '../../types/api';

export interface NotificationsResponse {
  notifications: StudentNotification[];
  unreadCount: number;
}

export async function fetchMyNotifications(): Promise<NotificationsResponse> {
  const { data } = await apiClient.get<NotificationsResponse>('/notifications/me');
  return data;
}

export async function markNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/me/read');
}
