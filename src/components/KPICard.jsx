import React from 'react';
// ─── KPICARD UI COMPONENT ─────────────────────────────────────────────────────

function KPICard({ label, value, sub, color1, color2, badge, action }) {
  return (
    <div className="kpi-card" style={{ '--c1': color1, '--c2': color2 }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {badge && <div className={`kpi-badge ${badge.cls}`}>{badge.text}</div>}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 12,
            padding: '8px 12px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-primary)',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {action.text}
        </button>
      )}
    </div>
  );
}

export default React.memo(KPICard);
