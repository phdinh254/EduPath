import { apiClient } from '../../lib/api-client';
import type { AdminStats, AuditLog, PaginatedResult } from '../../types/api';

export async function fetchStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>('/admin/stats');
  return data;
}

export async function fetchAuditLogs(
  page = 1,
  limit = 20,
): Promise<PaginatedResult<AuditLog>> {
  const { data } = await apiClient.get<PaginatedResult<AuditLog>>('/admin/audit-logs', {
    params: { page, limit },
  });
  return data;
}
