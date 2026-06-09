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
      return role && username ? { id: id ? parseInt(id, 10) : null, role, username } : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await apiClient(`${apiBase}/api/auth/me`);
      const data = await res.json();
      const authData = { id: data.id, role: data.role, username: data.username };
      localStorage.setItem('vd_role', data.role);
      localStorage.setItem('vd_user', data.username);
      localStorage.setItem('vd_id', data.id);
      setAuth(authData);
    } catch (err) {
      logger.info('Session verification failed (normal for unauthenticated users).', err);
      localStorage.removeItem('vd_role');
      localStorage.removeItem('vd_user');
      localStorage.removeItem('vd_id');
      setAuth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      const authData = { id: data.id, role: data.role, username: data.username };
      localStorage.setItem('vd_role', data.role);
      localStorage.setItem('vd_user', data.username);
      localStorage.setItem('vd_id', data.id);
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
      setAuth(null);
      window.location.href = '/login';
    }
  }, []);

  const value = useMemo(
    () => ({
      auth,
      userId: auth?.id || null,
      role: auth?.role || null,
      username: auth?.username || null,
      user: auth?.username || null,
      isAdmin: auth?.role === 'admin',
      isAuthenticated: !!auth,
      login,
      logout,
      isLoading,
    }),
    [auth, login, logout, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
