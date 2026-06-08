import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

const apiBase = import.meta.env.VITE_API_BASE || '';

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function UserManagementPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/auth/users`, {
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load users' });
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/admin-create`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setMsg({ type: 'success', text: `User "${username}" created successfully` });
      setUsername('');
      setPassword('');
      setRole('user');
      fetchUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, delUsername) => {
    if (!window.confirm(`Delete user "${delUsername}"?`)) return;
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/auth/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setMsg({ type: 'success', text: `User "${delUsername}" deleted` });
      fetchUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <div className="section-title">
        <span>User Management</span>
        <div className="section-line" />
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontFamily: "'Exo 2', sans-serif",
          background: msg.type === 'success' ? 'rgba(0,230,118,0.1)' : 'rgba(255,61,90,0.1)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(0,230,118,0.3)' : 'rgba(255,61,90,0.3)'}`,
          color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
        }}>
          {msg.text}
        </div>
      )}

      <div className="chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Add New User</div>
        <div className="chart-sub" style={{ marginBottom: 16 }}>Create a new admin or viewer account</div>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>USERNAME</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="filter-input"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="filter-input"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: '0 1 160px', minWidth: 120 }}>
            <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>ROLE</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="filter-select"
              style={{ width: '100%' }}
            >
              <option value="user">User (View only)</option>
              <option value="admin">Admin (Full access)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="filter-btn"
            style={{
              background: loading ? 'rgba(75,58,219,0.3)' : '#4B3ADB',
              color: '#fff',
              border: 'none',
              padding: '7px 20px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div className="chart-title" style={{ fontSize: 14 }}>Existing Users</div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No users found</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.username}</td>
                    <td>
                      <span className={`status-pill ${u.role === 'admin' ? 's-stores' : 's-ready'}`}
                        style={{
                          background: u.role === 'admin' ? 'rgba(75,58,219,0.15)' : 'rgba(156,163,175,0.2)',
                          color: u.role === 'admin' ? '#4B3ADB' : '#9ca3af',
                        }}
                      >
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(u.id, u.username)}
                        className="filter-btn"
                        style={{
                          color: 'var(--danger)',
                          borderColor: 'rgba(255,61,90,0.3)',
                          padding: '4px 14px',
                          fontSize: 11,
                          cursor: u.id === JSON.parse(atob(token.split('.')[1])).id ? 'not-allowed' : 'pointer',
                          opacity: u.id === JSON.parse(atob(token.split('.')[1])).id ? 0.4 : 1,
                        }}
                        disabled={u.id === JSON.parse(atob(token.split('.')[1])).id}
                        title={u.id === JSON.parse(atob(token.split('.')[1])).id ? 'Cannot delete yourself' : 'Delete user'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UserManagementPage;
