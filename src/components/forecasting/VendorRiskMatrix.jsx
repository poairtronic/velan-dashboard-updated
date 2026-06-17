import React, { useState, useEffect } from 'react';

const riskColors = {
  high: { bg: 'rgba(255, 61, 90, 0.15)', color: 'var(--danger)', label: 'HIGH' },
  medium: { bg: 'rgba(255, 184, 54, 0.15)', color: 'var(--warning)', label: 'MEDIUM' },
  low: { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--success)', label: 'LOW' }
};

function VendorRiskMatrix() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/forecast/vendor-risk', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>Loading vendor risk analysis...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>Failed to load: {error}</div>
    </div>
  );

  if (!data || !data.vendors) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: 1 }}>
            Vendor Risk Matrix
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
            SLA BREACH PROBABILITY PER VENDOR
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['high', 'medium', 'low'].map(risk => (
            <span key={risk} style={{
              fontSize: 10, fontFamily: 'Share Tech Mono, monospace',
              padding: '3px 8px', borderRadius: 10,
              background: riskColors[risk].bg, color: riskColors[risk].color
            }}>
              {data.metadata[`${risk}Risk`]} {riskColors[risk].label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['VENDOR', 'ITEMS', 'CURRENT AVG', 'HISTORICAL AVG', 'BREACH PROB.', 'RISK', 'CONFIDENCE'].map(h => (
                <th key={h} style={{
                  background: 'var(--bg-secondary)', padding: '10px 12px', textAlign: 'left',
                  fontSize: 10, letterSpacing: 1.5, color: 'var(--text-muted)',
                  fontFamily: 'Share Tech Mono, monospace', borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 2
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.vendors.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No active vendor items</td></tr>
            ) : (
              data.vendors.map((v, i) => {
                const risk = riskColors[v.riskLevel] || riskColors.low;
                const probColor = v.breachProbability > 75 ? 'var(--danger)' : v.breachProbability > 50 ? 'var(--warning)' : 'var(--success)';
                let confColor = 'var(--accent4)';
                if (v.confidence >= 80) confColor = 'var(--success)';
                else if (v.confidence >= 50) confColor = 'var(--warning)';

                return (
                  <tr key={i}>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 600 }}>{v.vendor}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.openItems}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.currentAvgDays}d</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.historicalAvgDays}d</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 14, background: 'var(--bg-bar-empty)', borderRadius: 3, overflow: 'hidden', maxWidth: 100 }}>
                          <div style={{
                            width: `${Math.min(100, v.breachProbability)}%`,
                            height: '100%', borderRadius: 3, background: probColor,
                            transition: 'width 0.8s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: probColor, fontWeight: 700 }}>{v.breachProbability}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace', background: risk.bg, color: risk.color }}>{risk.label}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)' }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: confColor,
                        background: `${confColor}22`, padding: '2px 6px', borderRadius: 8
                      }}>
                        {v.confidence}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          SLA Target: {data.metadata.slaTargetDays} days · Based on {data.metadata.basedOnDays} days of history · {data.metadata.totalVendors} vendors analyzed
        </span>
      </div>
    </div>
  );
}

export default VendorRiskMatrix;
