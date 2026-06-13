import React from 'react';
import { TARGET_DAYS } from '../../utils/calculationUtils';

function VendorTimeRanking({ vendors, maxDays }) {
  return (
    <div className="chart-card" style={{ marginBottom: 16 }}>
      <div className="chart-title">Vendor Operation — Time Ranking</div>
      <div className="chart-sub">SORTED BY AVG PENDING DAYS (HIGHEST = NEEDS ATTENTION)</div>
      <div className="vendor-bar-wrap" style={{ marginTop: 12 }}>
        {[...vendors]
          .sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0))
          .map((v, i) => {
            const pct = Math.min(100, Math.round(((v.avgDays || 0) / Math.max(maxDays, 1)) * 100));
            const overdue = (v.avgDays || 0) > TARGET_DAYS;
            return (
              <div className="vendor-row" key={i}>
                <div
                  className="vendor-name"
                  style={{ color: overdue ? 'var(--danger)' : 'var(--text-secondary)' }}
                >
                  {v.code}
                </div>
                <div className="vendor-bar-bg">
                  <div
                    className="vendor-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: overdue
                        ? 'linear-gradient(90deg,#ff3d5a,#ff6b35)'
                        : 'linear-gradient(90deg,#ffd60a,#b24bff)',
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 110,
                    textAlign: 'right',
                    fontSize: 11,
                    color: overdue ? 'var(--danger)' : 'var(--text-muted)',
                  }}
                >
                  {v.avgDays != null ? `${v.avgDays}d avg pending` : '-'} · {v.count} items
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default VendorTimeRanking;
