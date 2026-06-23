import { logger } from '../utils/logger';
import { normalizeError } from '../utils/errorHandler';

export const apiBase = import.meta.env.VITE_API_BASE || '';

export async function apiClient(url, options = {}) {
  options.headers = options.headers || {};

  // Always include credentials (cookies) for all API calls
  options.credentials = 'include';
  
  const timeoutMs = options.timeoutMs || 60000; // default to 60 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  try {
    const res = await fetch(url, options);
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401) {
        // Automatically redirect to /login and clear local role/user cache
        localStorage.removeItem('vd_role');
        localStorage.removeItem('vd_user');
        localStorage.removeItem('vd_id');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?reason=session_expired';
        }
      }

      const errorMessage = await normalizeError(res);
      const err = new Error(errorMessage);
      err.error = true;
      err.code = `HTTP_ERROR_${res.status}`;
      err.message = errorMessage;
      err.retryable = res.status >= 500 || res.status === 429;
      err.status = res.status;
      err.response = res;
      throw err;
    }

    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Check if error already has standardized shape
    if (error.error === true) {
      throw error;
    }

    logger.error(`API Error on ${url}`, error);
    
    if (error.name === 'AbortError') {
      const err = new Error('Request timed out after 60s');
      err.error = true;
      err.code = 'TIMEOUT';
      err.message = 'The server took too long to respond. Please try again.';
      err.retryable = true;
      throw err;
    }

    const errorMessage = error.message || 'A network error occurred. Please verify your connection.';
    const err = new Error(errorMessage);
    err.error = true;
    err.code = 'NETWORK_ERROR';
    err.message = errorMessage;
    err.retryable = true;
    throw err;
  }
}
