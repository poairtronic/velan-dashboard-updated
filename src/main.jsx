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
  const filename = event.filename || '';
  const message = event.message || '';
  // Ignore browser extension and third-party injected script errors
  if (
    filename.includes('content-all.js') || 
    filename.includes('extension') || 
    filename.includes('chrome-extension') ||
    filename.includes('moz-extension') ||
    message.includes('startTime') ||
    message.includes('forEach is not a function') ||
    !filename
  ) {
    return;
  }

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
  const msg = reason ? (reason.message || String(reason)) : '';
  if (msg.includes('startTime') || msg.includes('forEach is not a function') || msg.includes('extension')) {
    return;
  }

  const logPayload = {
    action: 'FRONTEND_ERROR',
    entityType: 'frontend_unhandled_rejection',
    metadata: {
      message: msg || 'Unhandled rejection',
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
