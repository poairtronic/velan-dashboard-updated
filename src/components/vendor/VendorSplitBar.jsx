import React from 'react';

function VendorSplitBar({ inhPct, venPct, inhouseCount, vendorCount }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div className="chart-title">Inhouse vs Vendor Workload Split</div>
      <div className="chart-sub">PERCENTAGE OF TOTAL ITEMS</div>
      <div style={{ display: 'flex', gap: 20, marginTop: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: `${inhPct}%`,
                background: 'linear-gradient(90deg,#00c9ff,#0fa8e0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#000',
              }}
            >
              {inhPct}% IH
            </div>
            <div
              style={{
                width: `${venPct}%`,
                background: 'linear-gradient(90deg,#b24bff,#ff6b35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {venPct}% VN
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--accent1)' }}>■ Inhouse: {inhouseCount}</span>
          <span style={{ fontSize: 12, color: 'var(--accent6)' }}>■ Vendor: {vendorCount}</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(VendorSplitBar);

