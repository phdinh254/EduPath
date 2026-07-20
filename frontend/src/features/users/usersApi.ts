import { apiClient } from '../../lib/api-client';
import type { Role, UserProfile } from '../../types/api';

export async function fetchUsers(role?: Role): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/users', { params: role ? { role } : undefined });
  return data;
}

export async function setUserActive(id: string, isActive: boolean): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>(`/users/${id}/status`, { isActive });
  return data;
}
