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
  const [activeTab, setActiveTab] = useState('existing'); // 'existing' or 'pending'

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
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status, targetUsername) => {
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/auth/users/${id}/status`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to update status to ${status}`);
      setMsg({ type: 'success', text: `User "${targetUsername}" has been ${status === 'approved' ? 'approved' : 'denied'}` });
      fetchUsers();
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
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
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const existingUsers = users.filter(u => u.status !== 'pending');
  const displayedUsers = activeTab === 'pending' ? pendingUsers : existingUsers;

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

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setActiveTab('existing')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'existing' ? '#4B3ADB' : 'var(--text-muted)',
            borderBottom: activeTab === 'existing' ? '2px solid #4B3ADB' : '2px solid transparent',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 14,
            transition: 'all 0.2s',
          }}
        >
          Existing Users ({existingUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'pending' ? '#4B3ADB' : 'var(--text-muted)',
            borderBottom: activeTab === 'pending' ? '2px solid #4B3ADB' : '2px solid transparent',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
        >
          Pending Approvals
          {pendingUsers.length > 0 && (
            <span style={{
              background: '#ff3d5a',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 10,
              lineHeight: 1
            }}>
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div className="chart-title" style={{ fontSize: 14 }}>
            {activeTab === 'pending' ? 'Pending Approvals' : 'Existing Users'}
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {displayedUsers.length} user{displayedUsers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                {activeTab === 'existing' && <th>Status</th>}
                <th>Created</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'existing' ? 5 : 4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                displayedUsers.map(u => (
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
                    {activeTab === 'existing' && (
                      <td>
                        <span className="status-pill"
                          style={{
                            background: u.status === 'approved' ? 'rgba(0,230,118,0.15)' : u.status === 'denied' ? 'rgba(255,61,90,0.15)' : 'rgba(156,163,175,0.2)',
                            color: u.status === 'approved' ? 'var(--success, #00e676)' : u.status === 'denied' ? 'var(--danger, #ff3d5a)' : '#9ca3af',
                          }}
                        >
                          {u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : 'Approved'}
                        </span>
                      </td>
                    )}
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {activeTab === 'pending' ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button
                            onClick={() => handleUpdateStatus(u.id, 'approved', u.username)}
                            className="filter-btn"
                            style={{
                              color: 'var(--success, #00e676)',
                              borderColor: 'rgba(0,230,118,0.3)',
                              padding: '4px 10px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(u.id, 'denied', u.username)}
                            className="filter-btn"
                            style={{
                              color: 'var(--danger, #ff3d5a)',
                              borderColor: 'rgba(255,61,90,0.3)',
                              padding: '4px 10px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
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
                      )}
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
