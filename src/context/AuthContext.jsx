import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react';

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
      const res = await fetch(`${apiBase}/api/auth/me`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const authData = { id: data.id, role: data.role, username: data.username };
        localStorage.setItem('vd_role', data.role);
        localStorage.setItem('vd_user', data.username);
        localStorage.setItem('vd_id', data.id);
        setAuth(authData);
      } else {
        localStorage.removeItem('vd_role');
        localStorage.removeItem('vd_user');
        localStorage.removeItem('vd_id');
        setAuth(null);
      }
    } catch (err) {
      console.error('Session verification failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Invalid credentials');
      if (data.status) err.status = data.status;
      throw err;
    }

    const authData = { id: data.id, role: data.role, username: data.username };
    localStorage.setItem('vd_role', data.role);
    localStorage.setItem('vd_user', data.username);
    localStorage.setItem('vd_id', data.id);
    setAuth(authData);
    return authData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      localStorage.removeItem('vd_role');
      localStorage.removeItem('vd_user');
      localStorage.removeItem('vd_id');
      setAuth(null);
      window.location.href = '/login';
    }
  }, []);

  const value = useMemo(() => ({
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
  }), [auth, login, logout, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


