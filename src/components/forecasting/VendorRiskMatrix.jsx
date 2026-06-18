import React, { useState, useEffect } from 'react';

const riskColors = {
  critical: { bg: 'rgba(255, 61, 140, 0.2)', color: '#ff3d8c', label: 'CRITICAL' },
  high: { bg: 'rgba(255, 61, 90, 0.15)', color: 'var(--danger)', label: 'HIGH' },
  medium: { bg: 'rgba(255, 184, 54, 0.15)', color: 'var(--warning)', label: 'MEDIUM' },
  low: { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--success)', label: 'LOW' }
};

function VendorRiskMatrix() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('risk_matrix');

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
      {/* Header */}
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
          {['critical', 'high', 'medium', 'low'].map(risk => (
            <span key={risk} style={{
              fontSize: 10, fontFamily: 'Share Tech Mono, monospace',
              padding: '3px 8px', borderRadius: 10,
              background: riskColors[risk].bg, color: riskColors[risk].color
            }}>
              {data.metadata[`${risk}Risk`] || 0} {riskColors[risk].label}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-header Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '0 10px' }}>
        <button
          onClick={() => setActiveTab('risk_matrix')}
          style={{
            background: 'none', border: 'none', borderBottom: activeTab === 'risk_matrix' ? '2px solid var(--accent1)' : '2px solid transparent',
            color: activeTab === 'risk_matrix' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, padding: '10px 16px', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          📊 VENDOR RISK MATRIX
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          style={{
            background: 'none', border: 'none', borderBottom: activeTab === 'validation' ? '2px solid var(--accent1)' : '2px solid transparent',
            color: activeTab === 'validation' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, padding: '10px 16px', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          🔍 SATURATION & RANK VALIDATION
        </button>
      </div>

      {activeTab === 'risk_matrix' ? (
        /* Risk Matrix View */
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['VENDOR', 'ITEMS', 'CURRENT AGE', 'HIST AVG / SLA', 'THROUGHPUT TREND', 'STABILITY / TREND', 'RISK SCORE', 'CONFIDENCE'].map(h => (
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
                <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No active vendor items</td></tr>
              ) : (
                data.vendors.map((v, i) => {
                  const risk = riskColors[v.riskLevel] || riskColors.low;
                  let confColor = 'var(--accent4)';
                  if (v.confidence >= 80) confColor = 'var(--success)';
                  else if (v.confidence >= 60) confColor = '#00c9ff';
                  else if (v.confidence >= 40) confColor = 'var(--warning)';

                  return (
                    <tr key={i}>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 600 }}>{v.vendor}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.openItems}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.currentAvgDays}d</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.historicalAvgDays}d / {data.metadata.slaTargetDays}d</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace' }}>{v.throughputTrend}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>
                        {v.stabilityScore} / <span style={{ color: v.riskTrend === 'Rising' ? 'var(--danger)' : v.riskTrend === 'Improving' ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>{v.riskTrend}</span>
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace',
                          background: risk.bg, color: risk.color, border: `1px solid ${risk.color}44`
                        }}>
                          {v.breachProbability}% - {risk.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)' }}>
                        <span style={{
                          fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: confColor,
                          background: `${confColor}22`, padding: '2px 6px', borderRadius: 8
                        }}>
                          {v.confidence}% {v.confidenceLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Validation View */
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['VENDOR', 'OLD SPECTRUM (SCORE / RISK / RANK)', 'NEW SPECTRUM (SCORE / RISK / RANK)', 'RANK SHIFT', 'ACCURACY GAIN'].map(h => (
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
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No vendor validation data</td></tr>
              ) : (
                data.vendors.map((v, i) => {
                  const rankDiff = v.oldModel.rank - v.newModel.rank;
                  let rankShiftText = 'Stable (—)';
                  let rankShiftColor = 'var(--text-muted)';
                  if (rankDiff > 0) {
                    rankShiftText = `Escalated (↑${rankDiff})`;
                    rankShiftColor = 'var(--danger)';
                  } else if (rankDiff < 0) {
                    rankShiftText = `Refined (↓${Math.abs(rankDiff)})`;
                    rankShiftColor = 'var(--success)';
                  }

                  const isSaturated = v.oldModel.riskScore === 100;

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,92,0.3)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 600 }}>{v.vendor}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        {v.oldModel.riskScore}% / {v.oldModel.riskLevel.toUpperCase()} / #{v.oldModel.rank}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>
                        {v.newModel.riskScore}% / {v.newModel.riskLevel.toUpperCase()} / #{v.newModel.rank}
                      </td>
                      <td style={{ padding: '10px 12px', color: rankShiftColor, fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>
                        {rankShiftText}
                      </td>
                      <td style={{ padding: '10px 12px', color: isSaturated ? 'var(--accent1)' : 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>
                        {isSaturated
                          ? 'Resolved 100% Saturation Flaw'
                          : 'Age-Ratio Curve Applied'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          SLA Target: {data.metadata.slaTargetDays} days · Based on {data.metadata.basedOnDays} days of history · {data.metadata.totalVendors} vendors analyzed
        </span>
      </div>
    </div>
  );
}

export default VendorRiskMatrix;
