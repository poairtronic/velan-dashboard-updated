import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AppErrorBoundary from '../../components/common/AppErrorBoundary';
import { logger } from '../../utils/logger';

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  }
}));

const ThrowError = () => {
  throw new Error('Test error');
};

describe('AppErrorBoundary Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent vitest from failing the test suite due to console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('catches errors and calls logger.error', () => {
    render(
      <AppErrorBoundary>
        <ThrowError />
      </AppErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(logger.error).toHaveBeenCalledWith(
      'React ErrorBoundary caught an error',
      expect.any(Error),
      expect.any(Object)
    );
  });
});
