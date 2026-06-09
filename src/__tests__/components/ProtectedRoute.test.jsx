import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';

// Mock the hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when loading', () => {
    useAuth.mockReturnValue({ isLoading: true });
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('redirects to login when user is not authenticated', () => {
    useAuth.mockReturnValue({ isLoading: false, user: null });
    // Since we're using MemoryRouter and <Navigate>, we can't easily assert the DOM change 
    // without mocking Navigate or checking router state, but we can verify children aren't rendered.
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('renders children when user is authenticated', () => {
    useAuth.mockReturnValue({ isLoading: false, user: { name: 'Test' }, isAdmin: false });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects to / when adminOnly is true but user is not admin', () => {
    useAuth.mockReturnValue({ isLoading: false, user: { name: 'Test' }, isAdmin: false });
    render(
      <MemoryRouter>
        <ProtectedRoute adminOnly={true}>
          <div data-testid="admin-content">Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('renders children when adminOnly is true and user is admin', () => {
    useAuth.mockReturnValue({ isLoading: false, user: { name: 'Admin' }, isAdmin: true });
    render(
      <MemoryRouter>
        <ProtectedRoute adminOnly={true}>
          <div data-testid="admin-content">Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });
});
