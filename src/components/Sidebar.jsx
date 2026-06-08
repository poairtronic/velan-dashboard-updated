import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../hooks/useAuth';
// ─── SIDEBAR UI COMPONENT ──────────────────────────────────────────────────────

// Static — defined outside component so the array reference is always stable
const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',        icon: '⬡' },
  { id: 'monthday',    label: 'Month / Day View', icon: '📅' },
  { id: 'database',    label: 'Database',         icon: '🗄' },
  { id: 'production',  label: 'Production',       icon: '⚙' },
  { id: 'wip',         label: 'Stage / WIP',      icon: '⟳' },
  { id: 'cycleTime',   label: 'Cycle Time',       icon: '⏱' },
  { id: 'bottleneck',  label: 'Bottleneck',       icon: '🔴' },
  { id: 'po',          label: 'PO Analysis',      icon: '📋' },
  { id: 'sc',          label: 'SC Sets',          icon: '📦' },
  { id: 'vendor',      label: 'Vendor Eval',      icon: '🏭' },
  { id: 'upload',      label: 'Upload Data',      icon: '⬆' },
  { id: 'users',       label: 'User Management',  icon: '👥' },
];

function Sidebar() {
  const { activeNav, setActiveNav } = useDashboard();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const filteredNavItems = NAV_ITEMS.filter(n => (n.id !== 'upload' && n.id !== 'users') || isAdmin);

  const handleNavClick = (id) => {
    setActiveNav(id);
    navigate(id === 'overview' ? '/' : `/${id}`);
  };

  return (
    <div className="sidebar">
      <div className="nav-section">NAVIGATION</div>
      {filteredNavItems.map(n => (
        <div
          key={n.id}
          className={`nav-item ${activeNav === n.id ? 'active' : ''}`}
          onClick={() => handleNavClick(n.id)}
        >
          <span className="nav-icon">{n.icon}</span>
          {n.label}
        </div>
      ))}
    </div>
  );
}

export default React.memo(Sidebar);