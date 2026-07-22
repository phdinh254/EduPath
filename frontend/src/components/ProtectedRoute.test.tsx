import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContext from '../features/auth/AuthContext';
import type { UserProfile } from '../types/api';

function renderWithRoute(allowedRoles: UserProfile['role'][] | undefined, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/" element={<div>Home page</div>} />
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/protected" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const baseUser: UserProfile = {
  id: '1',
  email: 'a@test.dev',
  fullName: 'Test User',
  role: 'STUDENT',
  isActive: true,
  createdAt: new Date().toISOString(),
};

describe('ProtectedRoute', () => {
  it('shows a loading state while auth status is resolving', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: vi.fn(),
      loginWithTokens: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute(['STUDENT']);
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginWithTokens: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute(['STUDENT']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects home when the user role is not allowed (blocks cross-role access)', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { ...baseUser, role: 'STUDENT' },
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      loginWithTokens: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute(['ADMIN']);
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('renders the protected content when the role is allowed', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { ...baseUser, role: 'STUDENT' },
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      loginWithTokens: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute(['STUDENT']);
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
