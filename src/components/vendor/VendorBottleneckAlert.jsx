import React from 'react';

function VendorBottleneckAlert({ bottleneck }) {
  if (!bottleneck) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg,rgba(255,61,90,0.1),rgba(255,107,53,0.08))',
        border: '1px solid rgba(255,61,90,0.3)',
        borderRadius: 10,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div className="chart-title" style={{ color: 'var(--danger)' }}>
        ⚠️ Vendor Bottleneck Alert
      </div>
      <div className="chart-sub">HIGHEST RISK VENDOR OPERATION</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 16,
          marginTop: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Bottleneck Operation
          </div>
          <div
            style={{
              fontFamily: 'Rajdhani',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--danger)',
            }}
          >
            {bottleneck.vendor}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Avg Pending Days
          </div>
          <div
            style={{
              fontFamily: 'Rajdhani',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--accent4)',
            }}
          >
            {bottleneck.avgPending}d
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            SLA Violations
          </div>
          <div
            style={{
              fontFamily: 'Rajdhani',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--danger)',
            }}
          >
            {bottleneck.slaViolations}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Process Efficiency
          </div>
          <div
            style={{
              fontFamily: 'Rajdhani',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--warning)',
            }}
          >
            {bottleneck.efficiency}%
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
        }}
      >
        This vendor operation has the highest bottleneck score and requires immediate attention.
        Consider process optimization or resource reallocation.
      </div>
    </div>
  );
}

export default React.memo(VendorBottleneckAlert);

