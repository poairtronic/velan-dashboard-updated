export const apiBase = import.meta.env.VITE_API_BASE || '';

export async function apiClient(url, options = {}) {
  options.headers = options.headers || {};
  
  // Always include credentials (cookies) for backend API calls
  const isBackend = url.startsWith('/api/') || (apiBase && url.startsWith(`${apiBase}/api/`));
  if (isBackend) {
    options.credentials = 'include';
  }
  
  const res = await fetch(url, options);
  
  if (res.status === 401 && isBackend) {
    // Automatically redirect to /login and clear local role/user cache
    localStorage.removeItem('vd_role');
    localStorage.removeItem('vd_user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  
  return res;
}
