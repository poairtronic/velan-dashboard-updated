import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';
import { apiClient } from '../services/apiClient';
import Modal from '../components/Modal';
import { Shield, Settings, CheckSquare, Square, Users } from 'lucide-react';
import TableExportDropdown from '../components/TableExportDropdown';

const apiBase = import.meta.env.VITE_API_BASE || '';

export const AVAILABLE_MODULES = [
  { id: 'overview', label: 'Overview', icon: '⬡', category: 'Executive', desc: 'Executive KPI Overview' },
  { id: 'monthday', label: 'Month / Day View', icon: '📅', category: 'Executive', desc: 'Monthly & Daily production views' },
  { id: 'database', label: 'Database', icon: '🗄', category: 'Operations', desc: 'Dataset queries & exports' },
  { id: 'production', label: 'Production', icon: '⚙', category: 'Operations', desc: 'Active line operations tracking' },
  { id: 'wip', label: 'Stage / WIP', icon: '⟳', category: 'Operations', desc: 'Live stage queues and WIP' },
  { id: 'cycleTime', label: 'Cycle Time', icon: '⏱', category: 'Analytics', desc: 'Cycle time & duration metrics' },
  { id: 'bottleneck', label: 'Bottleneck', icon: '🔴', category: 'Analytics', desc: 'Process bottleneck identification' },
  { id: 'po', label: 'PO Analysis', icon: '📋', category: 'Commercial', desc: 'Purchase orders & SLA metrics' },
  { id: 'sc', label: 'SC Sets', icon: '📦', category: 'Operations', desc: 'SC set tracking & stage completion' },
  { id: 'sales-projection', label: 'Sales Projection', icon: '📈', category: 'Commercial', desc: 'Sales delivery dates & SLA' },
  { id: 'vendor', label: 'Vendor Eval', icon: '🏭', category: 'Commercial', desc: 'Vendor scorecards & delays' },
  { id: 'executive', label: 'Executive Intel', icon: '📊', category: 'Executive', desc: 'Executive Intel reports' },
  { id: 'mic', label: 'Manufacturing Intel', icon: '⚡', category: 'Operations', desc: 'Throughput & telemetry metrics' },
  { id: 'executive-war-room', label: 'Production Control', icon: '⚔', category: 'Executive', desc: 'Mission control & interventions' },
  { id: 'forecast', label: 'Predictive Analytics', icon: '🔮', category: 'Analytics', desc: 'Predictive risk & capacity' },
  { id: 'inventory', label: 'Inventory', icon: '✂', category: 'Operations', desc: 'Bar cutting & inventory tracking' },
];

const ALL_MODULE_IDS = AVAILABLE_MODULES.map((m) => m.id);

const PRESETS = {
  ALL: { label: 'All Modules', ids: ALL_MODULE_IDS },
  PRODUCTION: { label: 'Production / Shopfloor', ids: ['production', 'wip', 'cycleTime', 'bottleneck', 'sc', 'inventory', 'database'] },
  COMMERCIAL: { label: 'Sales & Commercial', ids: ['overview', 'po', 'sales-projection', 'sc', 'vendor', 'executive'] },
  EXECUTIVE: { label: 'Executive Leadership', ids: ['overview', 'monthday', 'executive', 'mic', 'forecast', 'executive-war-room', 'vendor'] },
  MINIMAL: { label: 'Clear All', ids: [] },
};

function UserManagementPage() {
  const { userId } = useAuth();
  const userTableRef = React.useRef(null);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [selectedModules, setSelectedModules] = useState(ALL_MODULE_IDS);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('existing'); // 'existing' or 'pending'

  // Edit Permissions Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('user');
  const [editModules, setEditModules] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient(`${apiBase}/api/auth/users`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      logger.error('Failed to load users:', err);
      setMsg({ type: 'error', text: 'Failed to load users' });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      try {
        const res = await apiClient(`${apiBase}/api/auth/users`);
        const data = await res.json();
        if (active) setUsers(data);
      } catch (err) {
        logger.error('Failed to load users:', err);
        if (active) setMsg({ type: 'error', text: 'Failed to load users' });
      }
    };
    loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const allowed_modules = role === 'admin' ? [] : selectedModules;
      await apiClient(`${apiBase}/api/auth/admin-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, allowed_modules }),
      });
      setMsg({ type: 'success', text: `User "${username}" created successfully with ${role === 'admin' ? 'Full Admin' : `${allowed_modules.length} sidebar modules`}.` });
      toast.success(`User "${username}" created successfully.`);
      setUsername('');
      setPassword('');
      setRole('user');
      setSelectedModules(ALL_MODULE_IDS);
      fetchUsers();
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      logger.error('Create user failed:', err);
      setMsg({ type: 'error', text: err.message });
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setEditRole(user.role || 'user');
    // If user has allowed_modules, use them. If user is legacy user without allowed_modules, default to all non-admin
    const userMods = Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0
      ? user.allowed_modules
      : ALL_MODULE_IDS;
    setEditModules(userMods);
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const allowed_modules = editRole === 'admin' ? [] : editModules;
      await apiClient(`${apiBase}/api/auth/users/${editingUser.id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_modules, role: editRole }),
      });
      toast.success(`Permissions for "${editingUser.username}" updated successfully.`);
      setEditingUser(null);
      fetchUsers();
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      logger.error('Failed to update permissions:', err);
      toast.error(err.message || 'Failed to update user permissions.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdateStatus = async (id, status, targetUsername) => {
    setMsg(null);
    try {
      await apiClient(`${apiBase}/api/auth/users/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setMsg({
        type: 'success',
        text: `User "${targetUsername}" has been ${status === 'approved' ? 'approved' : 'denied'}`,
      });
      toast.success(`User status updated to ${status}.`);
      fetchUsers();
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      logger.error('Update status failed:', err);
      setMsg({ type: 'error', text: err.message });
      toast.error(err.message);
    }
  };

  const handleDelete = async (id, delUsername) => {
    if (!window.confirm(`Are you sure you want to delete user "${delUsername}"?`)) return;
    setMsg(null);
    try {
      await apiClient(`${apiBase}/api/auth/users/${id}`, {
        method: 'DELETE',
      });
      setMsg({ type: 'success', text: `User "${delUsername}" deleted` });
      toast.success(`User "${delUsername}" deleted.`);
      fetchUsers();
      window.dispatchEvent(new CustomEvent('pending-users-updated'));
    } catch (err) {
      logger.error('Delete user failed:', err);
      setMsg({ type: 'error', text: err.message });
      toast.error(err.message);
    }
  };

  const toggleModuleSelection = (modId, list, setList) => {
    setList((prev) => (prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]));
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const existingUsers = users.filter((u) => u.status !== 'pending');
  const displayedUsers = activeTab === 'pending' ? pendingUsers : existingUsers;

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* SECTION TITLE */}
      <div className="section-title">
        <span>User Management & Role Permissions</span>
        <div className="section-line" />
      </div>

      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 600,
            background: msg.type === 'success' ? 'rgba(0,230,118,0.1)' : 'rgba(255,61,90,0.1)',
            border: `1px solid ${msg.type === 'success' ? 'rgba(0,230,118,0.3)' : 'rgba(255,61,90,0.3)'}`,
            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {msg.text}
        </div>
      )}

      {/* ADD NEW USER CARD */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="var(--accent1)" />
              Add New User & Assign Sidebar Modules
            </div>
            <div className="chart-sub" style={{ marginTop: 2 }}>
              Create an account and customize which sidebar modules and dashboards they can access.
            </div>
          </div>
        </div>

        <form onSubmit={handleCreate}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ flex: '1 1 180px', minWidth: 140 }}>
              <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>
                USERNAME
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. operator1, sales_lead"
                className="filter-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 140 }}>
              <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>
                PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="filter-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: '0 1 180px', minWidth: 140 }}>
              <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>
                ACCOUNT ROLE
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="filter-select"
                style={{ width: '100%' }}
              >
                <option value="user">User (Custom Modules)</option>
                <option value="admin">Admin (Full System Access)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="filter-btn"
              style={{
                background: loading ? 'rgba(0,201,255,0.3)' : 'var(--accent1, #00c9ff)',
                color: '#000',
                border: 'none',
                padding: '8px 24px',
                fontWeight: 700,
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: 6,
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Creating...' : '+ CREATE USER'}
            </button>
          </div>

          {/* GRANULAR MODULE SELECTOR */}
          {role === 'user' ? (
            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '14px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent1)', fontFamily: 'Share Tech Mono', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={14} />
                  ASSIGN VISIBLE SIDEBAR MODULES ({selectedModules.length}/{AVAILABLE_MODULES.length} Selected):
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedModules(preset.ids)}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        fontSize: 10,
                        borderRadius: 4,
                        fontFamily: 'Share Tech Mono',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Checkbox Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 8,
                }}
              >
                {AVAILABLE_MODULES.map((m) => {
                  const isChecked = selectedModules.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleModuleSelection(m.id, selectedModules, setSelectedModules)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: isChecked ? '1px solid rgba(0, 201, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                        background: isChecked ? 'rgba(0, 201, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ color: isChecked ? 'var(--accent1)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </span>
                      <span style={{ fontSize: 13 }}>{m.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(75, 58, 219, 0.1)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(75, 58, 219, 0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={18} color="#4B3ADB" />
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                <strong>Admin Privileges:</strong> Administrators automatically have full access to all existing and future modules, including User Management, Enterprise Health, Audit Trail, and Data Upload.
              </div>
            </div>
          )}
        </form>
      </div>

      {/* TABS FOR EXISTING / PENDING */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          onClick={() => setActiveTab('existing')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'existing' ? 'var(--accent1)' : 'var(--text-muted)',
            borderBottom: activeTab === 'existing' ? '2px solid var(--accent1)' : '2px solid transparent',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 15,
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
            color: activeTab === 'pending' ? 'var(--accent1)' : 'var(--text-muted)',
            borderBottom: activeTab === 'pending' ? '2px solid var(--accent1)' : '2px solid transparent',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
        >
          Pending Approvals
          {pendingUsers.length > 0 && (
            <span
              style={{
                background: '#ff3d5a',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 10,
                lineHeight: 1,
              }}
            >
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* USER TABLE */}
      <div className="table-card">
        <div className="table-header">
          <div className="chart-title" style={{ fontSize: 14 }}>
            {activeTab === 'pending' ? 'Pending Approval Requests' : 'Configured Users & Module Access'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {displayedUsers.length} user{displayedUsers.length !== 1 ? 's' : ''}
            </span>
            <TableExportDropdown title={activeTab === 'pending' ? 'Pending Approval Requests' : 'Configured Users & Module Access'} tableRef={userTableRef} />
          </div>
        </div>
        <div className="table-wrap">
          <table ref={userTableRef}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Sidebar Module Access</th>
                {activeTab === 'existing' && <th>Status</th>}
                <th>Created</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeTab === 'existing' ? 6 : 5}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const mods = Array.isArray(u.allowed_modules) ? u.allowed_modules : [];
                  const isAll = !isAdmin && (mods.length === 0 || mods.length >= AVAILABLE_MODULES.length);
                  const effectiveCount = isAdmin ? AVAILABLE_MODULES.length + 4 : (mods.length === 0 ? AVAILABLE_MODULES.length : mods.length);

                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13 }}>{u.username}</span>
                          {u.id === userId && (
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,201,255,0.2)', color: 'var(--accent1)' }}>
                              (You)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            background: isAdmin ? 'rgba(75,58,219,0.15)' : 'rgba(0,201,255,0.15)',
                            color: isAdmin ? '#4B3ADB' : '#00c9ff',
                            border: `1px solid ${isAdmin ? 'rgba(75,58,219,0.4)' : 'rgba(0,201,255,0.4)'}`,
                          }}
                        >
                          {isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>

                      {/* SIDEBAR MODULE ACCESS PILLS */}
                      <td>
                        {isAdmin ? (
                          <span style={{ fontSize: 11, color: '#4B3ADB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={13} /> Full System (All Modules)
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              style={{
                                background: isAll ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 201, 255, 0.1)',
                                border: `1px solid ${isAll ? 'rgba(0, 230, 118, 0.3)' : 'rgba(0, 201, 255, 0.3)'}`,
                                color: isAll ? 'var(--success)' : 'var(--accent1)',
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontFamily: 'Share Tech Mono',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Click to customize modules"
                            >
                              <Settings size={11} />
                              {isAll ? `All ${AVAILABLE_MODULES.length} Modules` : `${effectiveCount} / ${AVAILABLE_MODULES.length} Modules`}
                            </button>

                            {/* Small preview of first few modules */}
                            {!isAll && mods.length > 0 && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                ({mods.slice(0, 3).map((id) => AVAILABLE_MODULES.find((m) => m.id === id)?.label || id).join(', ')}
                                {mods.length > 3 ? ` + ${mods.length - 3} more` : ''})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {activeTab === 'existing' && (
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              background:
                                u.status === 'approved'
                                  ? 'rgba(0,230,118,0.15)'
                                  : u.status === 'denied'
                                    ? 'rgba(255,61,90,0.15)'
                                    : 'rgba(156,163,175,0.2)',
                              color:
                                u.status === 'approved'
                                  ? 'var(--success, #00e676)'
                                  : u.status === 'denied'
                                    ? 'var(--danger, #ff3d5a)'
                                    : '#9ca3af',
                            }}
                          >
                            {u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : 'Approved'}
                          </span>
                        </td>
                      )}
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
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
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="filter-btn"
                              style={{
                                color: 'var(--accent1)',
                                borderColor: 'rgba(0,201,255,0.3)',
                                padding: '4px 10px',
                                fontSize: 11,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Edit sidebar permissions & role"
                            >
                              <Settings size={12} />
                              Edit Access
                            </button>
                            <button
                              onClick={() => handleDelete(u.id, u.username)}
                              className="filter-btn"
                              style={{
                                color: 'var(--danger)',
                                borderColor: 'rgba(255,61,90,0.3)',
                                padding: '4px 10px',
                                fontSize: 11,
                                cursor: u.id === userId ? 'not-allowed' : 'pointer',
                                opacity: u.id === userId ? 0.4 : 1,
                              }}
                              disabled={u.id === userId}
                              title={u.id === userId ? 'Cannot delete yourself' : 'Delete user'}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT PERMISSIONS MODAL */}
      {editingUser && (
        <Modal
          isOpen={true}
          onClose={() => setEditingUser(null)}
          title={`Customize Module Access — ${editingUser.username}`}
          maxWidth="640px"
        >
          <div style={{ padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>CONFIGURING USER</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{editingUser.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'Share Tech Mono', color: 'var(--text-muted)' }}>ROLE:</span>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="filter-select"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  <option value="user">User (Custom)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
            </div>

            {editRole === 'user' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent1)', fontFamily: 'Share Tech Mono' }}>
                    SELECT ALLOWED SIDEBAR MODULES ({editModules.length}/{AVAILABLE_MODULES.length}):
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditModules(preset.ids)}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          padding: '2px 8px',
                          fontSize: 10,
                          borderRadius: 4,
                          fontFamily: 'Share Tech Mono',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 8,
                    maxHeight: '340px',
                    overflowY: 'auto',
                    padding: '4px',
                    marginBottom: 16,
                  }}
                >
                  {AVAILABLE_MODULES.map((m) => {
                    const isChecked = editModules.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleModuleSelection(m.id, editModules, setEditModules)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: isChecked ? '1px solid rgba(0, 201, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                          background: isChecked ? 'rgba(0, 201, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ color: isChecked ? 'var(--accent1)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </span>
                        <span style={{ fontSize: 13 }}>{m.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(75, 58, 219, 0.1)', padding: '14px', borderRadius: 8, border: '1px solid rgba(75, 58, 219, 0.3)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                  Administrator role gives full permission across the entire suite, including all operational dashboards, user management, audit logs, and data uploads.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="filter-btn"
                style={{ padding: '6px 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingEdit}
                className="filter-btn"
                style={{
                  background: 'var(--accent1, #00c9ff)',
                  color: '#000',
                  fontWeight: 700,
                  fontFamily: 'Share Tech Mono',
                  border: 'none',
                  padding: '6px 18px',
                  borderRadius: 6,
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  opacity: savingEdit ? 0.6 : 1,
                }}
              >
                {savingEdit ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default UserManagementPage;
