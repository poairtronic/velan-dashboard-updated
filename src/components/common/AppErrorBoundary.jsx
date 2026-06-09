import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from './ErrorFallback';
import { logger } from '../../utils/logger';

export default function AppErrorBoundary({ children, fallbackRender }) {
  const handleError = (error, info) => {
    logger.error('React ErrorBoundary caught an error', error, info);
  };

  return (
    <ErrorBoundary FallbackComponent={fallbackRender || ErrorFallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}
