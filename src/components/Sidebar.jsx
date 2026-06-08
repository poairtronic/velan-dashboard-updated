import React from 'react';
import { useDashboard } from '../context/DashboardContext';
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
];

function Sidebar() {
  const { activeNav, setActiveNav } = useDashboard();

  return (
    <div className="sidebar">
      <div className="nav-section">NAVIGATION</div>
      {NAV_ITEMS.map(n => (
        <div
          key={n.id}
          className={`nav-item ${activeNav === n.id ? 'active' : ''}`}
          onClick={() => setActiveNav(n.id)}
        >
          <span className="nav-icon">{n.icon}</span>
          {n.label}
        </div>
      ))}
    </div>
  );
}

export default React.memo(Sidebar);