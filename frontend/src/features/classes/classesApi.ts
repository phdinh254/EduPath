import { apiClient } from '../../lib/api-client';
import type { SchoolClass, StudentClassLink } from '../../types/api';

// Giáo viên
export async function fetchMyClasses(): Promise<SchoolClass[]> {
  const { data } = await apiClient.get<SchoolClass[]>('/classes');
  return data;
}

export async function createClass(payload: { name: string }): Promise<SchoolClass> {
  const { data } = await apiClient.post<SchoolClass>('/classes', payload);
  return data;
}

export async function updateClass(classId: string, payload: { name: string }): Promise<SchoolClass> {
  const { data } = await apiClient.patch<SchoolClass>(`/classes/${classId}`, payload);
  return data;
}

export async function deleteClass(classId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}`);
}

export async function fetchClassStudents(classId: string): Promise<StudentClassLink[]> {
  const { data } = await apiClient.get<StudentClassLink[]>(`/classes/${classId}/students`);
  return data;
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}/students/${studentId}`);
}

// Học sinh
export async function fetchMyEnrolledClasses(): Promise<StudentClassLink[]> {
  const { data } = await apiClient.get<StudentClassLink[]>('/classes/mine');
  return data;
}

export async function joinClassByInviteCode(inviteCode: string): Promise<StudentClassLink> {
  const { data } = await apiClient.post<StudentClassLink>('/classes/join', { inviteCode });
  return data;
}
