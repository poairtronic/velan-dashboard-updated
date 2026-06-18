import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import { useAuth } from '../hooks/useAuth';
// ─── SIDEBAR UI COMPONENT ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '⬡' },
  { id: 'executive', label: 'Executive Intel', icon: '📊' },
  { id: 'mic', label: 'Manufacturing Intel', icon: '⚡' },
  { id: 'executive-war-room', label: 'Executive War Room', icon: '⚔' },
  { id: 'forecast', label: 'Predictive Analytics', icon: '🔮' },
  { id: 'monthday', label: 'Month / Day View', icon: '📅' },
  { id: 'database', label: 'Database', icon: '🗄' },
  { id: 'production', label: 'Production', icon: '⚙' },
  { id: 'wip', label: 'Stage / WIP', icon: '⟳' },
  { id: 'cycleTime', label: 'Cycle Time', icon: '⏱' },
  { id: 'bottleneck', label: 'Bottleneck', icon: '🔴' },
  { id: 'po', label: 'PO Analysis', icon: '📋' },
  { id: 'sc', label: 'SC Sets', icon: '📦' },
  { id: 'vendor', label: 'Vendor Eval', icon: '🏭' },
  { id: 'upload', label: 'Upload Data', icon: '⬆' },
  { id: 'users', label: 'User Management', icon: '👥' },
  { id: 'audit-trail', label: 'Audit Trail', icon: '📜' },
  { id: 'health', label: 'Enterprise Health', icon: '🛡' },
];

function Sidebar() {
  const navigate = useNavigate();
  const { activeNav, setActiveNav } = useUI();
  const { isAdmin } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const filteredNavItems = NAV_ITEMS.filter(
    (n) => (n.id !== 'upload' && n.id !== 'users' && n.id !== 'health' && n.id !== 'executive-war-room' && n.id !== 'audit-trail') || isAdmin
  );

  const fetchPendingCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      const res = await fetch(`${apiBase}/api/auth/users/pending-count`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count);
      }
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPendingCount();
    window.addEventListener('pending-users-updated', fetchPendingCount);
    // Poll every 30 seconds as fallback
    const interval = setInterval(fetchPendingCount, 30000);

    return () => {
      window.removeEventListener('pending-users-updated', fetchPendingCount);
      clearInterval(interval);
    };
  }, [fetchPendingCount]);

  const handleNavClick = (id) => {
    setActiveNav(id);
    navigate(id === 'overview' ? '/' : `/${id}`);
  };

  return (
    <div className="sidebar">
      <div className="nav-section">NAVIGATION</div>
      {filteredNavItems.map((n) => (
        <button
          key={n.id}
          className={`nav-item ${activeNav === n.id ? 'active' : ''}`}
          onClick={() => handleNavClick(n.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: 8,
            background: 'transparent',
            border: 'none',
            borderLeft: '3px solid transparent',
            fontFamily: 'inherit',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </div>
          {n.id === 'users' && pendingCount > 0 && (
            <span
              className="pending-badge"
              style={{
                background: '#ff3d5a',
                color: '#fff',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: 'bold',
                minWidth: '16px',
                textAlign: 'center',
                lineHeight: '1',
                marginRight: '8px',
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default React.memo(Sidebar);
