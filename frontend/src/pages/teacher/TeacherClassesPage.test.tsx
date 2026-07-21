import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { TeacherClassesPage } from './TeacherClassesPage';
import * as classesApi from '../../features/classes/classesApi';
import type { SchoolClass } from '../../types/api';

vi.mock('../../features/classes/classesApi');

const mockClass: SchoolClass = {
  id: 'class-1',
  tenantId: 'tenant-1',
  name: 'Lớp 12A1',
  inviteCode: 'ABC12345',
  isPublic: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('TeacherClassesPage', () => {
  it('shows empty state when there are no classes yet', async () => {
    vi.mocked(classesApi.fetchMyClasses).mockResolvedValue([]);
    renderWithProviders(<TeacherClassesPage />);

    expect(await screen.findByText('Chưa có lớp học nào. Hãy tạo lớp đầu tiên.')).toBeInTheDocument();
  });

  it('lists existing classes with their invite code', async () => {
    vi.mocked(classesApi.fetchMyClasses).mockResolvedValue([mockClass]);
    renderWithProviders(<TeacherClassesPage />);

    expect(await screen.findByText('Lớp 12A1')).toBeInTheDocument();
    expect(screen.getByText(/ABC12345/)).toBeInTheDocument();
  });

  it('creates a class through the modal form and calls the API with the entered name', async () => {
    const user = userEvent.setup();
    vi.mocked(classesApi.fetchMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.createClass).mockResolvedValue({ ...mockClass, name: 'Lớp mới' });

    renderWithProviders(<TeacherClassesPage />);
    await screen.findByText('Chưa có lớp học nào. Hãy tạo lớp đầu tiên.');

    await user.click(screen.getByRole('button', { name: '+ Tạo lớp mới' }));
    await user.type(screen.getByPlaceholderText('Tên lớp'), 'Lớp mới');
    await user.click(screen.getByRole('button', { name: 'Tạo lớp' }));

    await waitFor(() => {
      expect(classesApi.createClass).toHaveBeenCalledWith({ name: 'Lớp mới', isPublic: false });
    });
  });
});
