import { logger } from '../utils/logger';
import { normalizeError } from '../utils/errorHandler';

export const apiBase = import.meta.env.VITE_API_BASE || '';

export async function apiClient(url, options = {}) {
  options.headers = options.headers || {};

  // Always include credentials (cookies) for backend API calls
  const isBackend = url.startsWith('/api/') || (apiBase && url.startsWith(`${apiBase}/api/`));
  if (isBackend) {
    options.credentials = 'include';
  }

  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      if (res.status === 401 && isBackend) {
        // Automatically redirect to /login and clear local role/user cache
        localStorage.removeItem('vd_role');
        localStorage.removeItem('vd_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      const errorMessage = await normalizeError(res);
      const err = new Error(errorMessage);
      err.status = res.status;
      err.response = res;
      throw err;
    }

    return res;
  } catch (error) {
    logger.error(`API Error on ${url}`, error);
    if (!error.status) {
      // Network error or other non-HTTP error
      const errorMessage = await normalizeError(error);
      throw new Error(errorMessage);
    }
    throw error;
  }
}
