import { apiClient } from '../../lib/api-client';
import type { PaginatedResult, Role, UserProfile } from '../../types/api';

export async function fetchUsers(
  role?: Role,
  page = 1,
  limit = 20,
): Promise<PaginatedResult<UserProfile>> {
  const { data } = await apiClient.get<PaginatedResult<UserProfile>>('/users', {
    params: { role, page, limit },
  });
  return data;
}

export async function setUserActive(id: string, isActive: boolean): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>(`/users/${id}/status`, { isActive });
  return data;
}
