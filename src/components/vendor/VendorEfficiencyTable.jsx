import React from 'react';

function VendorEfficiencyTable({ vendors }) {
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
      <div className="chart-title">⏱ Process Cycle Time & Efficiency by Vendor Operation</div>
      <div className="chart-sub">
        AVERAGE TIME FROM PO RECEIPT · PROCESS COMPLETION RATE · SLA VIOLATIONS (2d+ PENDING)
      </div>
      <div className="vendor-bar-wrap" style={{ marginTop: 12 }}>
        {[...vendors]
          .sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0))
          .map((v, i) => {
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(26,58,92,0.4)',
                }}
              >
                <div
                  style={{
                    width: 90,
                    fontFamily: 'Share Tech Mono',
                    fontSize: 11,
                    color: 'var(--accent1)',
                    fontWeight: 700,
                  }}
                >
                  {v.code}
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Avg Pending Days
                  </div>
                  <div
                    style={{
                      fontFamily: 'Rajdhani',
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--accent4)',
                    }}
                  >
                    {v.avgDays != null ? `${v.avgDays}d` : '—'}
                  </div>
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Completion Rate
                  </div>
                  <div
                    style={{
                      fontFamily: 'Rajdhani',
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--success)',
                    }}
                  >
                    {v.processEfficiency != null ? `${v.processEfficiency}%` : '—'}
                  </div>
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                    SLA Violations (2d+)
                  </div>
                  <div
                    style={{
                      fontFamily: 'Rajdhani',
                      fontSize: 16,
                      fontWeight: 700,
                      color: v.slaViolations > 0 ? 'var(--danger)' : 'var(--success)',
                    }}
                  >
                    {v.slaViolations || 0}
                  </div>
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Violation Rate
                  </div>
                  <div
                    style={{
                      fontFamily: 'Rajdhani',
                      fontSize: 16,
                      fontWeight: 700,
                      color:
                        v.slaViolationRate > 20
                          ? 'var(--danger)'
                          : v.slaViolationRate > 10
                            ? 'var(--warning)'
                            : 'var(--success)',
                    }}
                  >
                    {v.slaViolationRate != null ? `${v.slaViolationRate}%` : '—'}
                  </div>
                </div>
                <div style={{ flex: 0.2 }}>
                  <span
                    className={`status-pill ${v.slaViolations === 0 ? 'badge-green' : v.slaViolationRate > 20 ? 'badge-red' : 'badge-yellow'}`}
                  >
                    {v.slaViolations === 0
                      ? '✓ COMPLIANT'
                      : v.slaViolationRate > 20
                        ? '⚠ CRITICAL'
                        : '⚡ WARNING'}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default VendorEfficiencyTable;
