import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { initSentry } from './utils/sentry';
import { initLogRocket } from './utils/logrocket';
import App from './App';

// Initialize Enterprise Observability
initSentry();
initLogRocket();

window.addEventListener('error', (event) => {
  const logPayload = {
    action: 'FRONTEND_ERROR',
    entityType: 'frontend_global_error',
    metadata: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : ''
    }
  };
  const apiBase = import.meta.env.VITE_API_BASE || '';
  fetch(`${apiBase}/api/audit/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logPayload)
  }).catch(err => console.error('Failed to log global window error:', err));
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const logPayload = {
    action: 'FRONTEND_ERROR',
    entityType: 'frontend_unhandled_rejection',
    metadata: {
      message: reason ? (reason.message || String(reason)) : 'Unhandled rejection',
      stack: reason && reason.stack ? reason.stack : ''
    }
  };
  const apiBase = import.meta.env.VITE_API_BASE || '';
  fetch(`${apiBase}/api/audit/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logPayload)
  }).catch(err => console.error('Failed to log unhandled rejection:', err));
});

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
