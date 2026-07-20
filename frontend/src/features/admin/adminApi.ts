import { apiClient } from '../../lib/api-client';
import type { AdminStats, AuditLog, Tenant } from '../../types/api';

export async function fetchStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>('/admin/stats');
  return data;
}

export async function fetchTenants(): Promise<Tenant[]> {
  const { data } = await apiClient.get<Tenant[]>('/admin/tenants');
  return data;
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data } = await apiClient.get<AuditLog[]>('/admin/audit-logs');
  return data;
}
