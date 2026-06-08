import React, { createContext, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => {
    try {
      const token = localStorage.getItem('vd_token');
      const role = localStorage.getItem('vd_role');
      const username = localStorage.getItem('vd_user');
      return token && role ? { token, role, username } : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username, password) => {
    const apiBase = import.meta.env.VITE_API_BASE || '';
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }

    const authData = { token: data.token, role: data.role, username: data.username };
    localStorage.setItem('vd_token', data.token);
    localStorage.setItem('vd_role', data.role);
    localStorage.setItem('vd_user', data.username);
    setAuth(authData);
    return authData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('vd_token');
    localStorage.removeItem('vd_role');
    localStorage.removeItem('vd_user');
    setAuth(null);
    navigate('/login');
  }, [navigate]);

  const value = useMemo(() => ({
    auth,
    token: auth?.token || null,
    role: auth?.role || null,
    username: auth?.username || null,
    user: auth?.username || null,
    isAdmin: auth?.role === 'admin',
    isAuthenticated: !!auth,
    login,
    logout,
    isLoading: false,
  }), [auth, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
