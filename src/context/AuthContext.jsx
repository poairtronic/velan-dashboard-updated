import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';
import { apiClient } from '../services/apiClient';

const apiBase = import.meta.env.VITE_API_BASE || '';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      // Optimistic cache for instant UI rendering, verified immediately on mount
      const role = localStorage.getItem('vd_role');
      const username = localStorage.getItem('vd_user');
      const id = localStorage.getItem('vd_id');
      const savedModules = localStorage.getItem('vd_modules');
      const allowedModules = savedModules ? JSON.parse(savedModules) : [];
      return role && username ? { id: id ? parseInt(id, 10) : null, role, username, allowedModules } : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await apiClient(`${apiBase}/api/auth/me`);
      const data = await res.json();
      const allowedModules = Array.isArray(data.allowed_modules) ? data.allowed_modules : [];
      const authData = { id: data.id, role: data.role, username: data.username, allowedModules };
      localStorage.setItem('vd_role', data.role);
      localStorage.setItem('vd_user', data.username);
      localStorage.setItem('vd_id', data.id);
      localStorage.setItem('vd_modules', JSON.stringify(allowedModules));
      setAuth(authData);
    } catch (err) {
      logger.info('Session verification failed (normal for unauthenticated users).', err);
      localStorage.removeItem('vd_role');
      localStorage.removeItem('vd_user');
      localStorage.removeItem('vd_id');
      localStorage.removeItem('vd_modules');
      setAuth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // eslint-disable-next-line
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (username, password) => {
    try {
      const res = await apiClient(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      const allowedModules = Array.isArray(data.allowed_modules) ? data.allowed_modules : [];
      const authData = { id: data.id, role: data.role, username: data.username, allowedModules };
      localStorage.setItem('vd_role', data.role);
      localStorage.setItem('vd_user', data.username);
      localStorage.setItem('vd_id', data.id);
      localStorage.setItem('vd_modules', JSON.stringify(allowedModules));
      setAuth(authData);
      toast.success('Successfully logged in.');
      return authData;
    } catch (err) {
      logger.error('Login failed:', err);
      toast.error(err.message || 'Login failed. Please check your credentials.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient(`${apiBase}/api/auth/logout`, { method: 'POST' });
      toast.success('Successfully logged out.');
    } catch (err) {
      logger.error('Logout request failed:', err);
      toast.error('Failed to log out cleanly, but local session cleared.');
    } finally {
      localStorage.removeItem('vd_role');
      localStorage.removeItem('vd_user');
      localStorage.removeItem('vd_id');
      localStorage.removeItem('vd_modules');
      setAuth(null);
      window.location.href = '/login';
    }
  }, []);

  const hasModuleAccess = useCallback(
    (moduleId) => {
      if (!auth) return false;
      if (auth.role === 'admin') return true;
      const modules = auth.allowedModules || [];
      if (modules.length === 0) {
        // Fallback for legacy users before custom modules were assigned:
        const nonAdminDefaults = [
          'overview',
          'monthday',
          'database',
          'production',
          'wip',
          'cycleTime',
          'bottleneck',
          'po',
          'sc',
          'sales-projection',
          'vendor',
          'executive',
          'mic',
          'forecast',
          'inventory',
        ];
        return nonAdminDefaults.includes(moduleId);
      }
      return modules.includes(moduleId);
    },
    [auth]
  );

  const value = useMemo(
    () => ({
      auth,
      userId: auth?.id || null,
      role: auth?.role || null,
      username: auth?.username || null,
      user: auth?.username || null,
      allowedModules: auth?.allowedModules || [],
      isAdmin: auth?.role === 'admin',
      isAuthenticated: !!auth,
      hasModuleAccess,
      login,
      logout,
      isLoading,
    }),
    [auth, hasModuleAccess, login, logout, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
