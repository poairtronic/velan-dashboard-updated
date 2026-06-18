import React, { useState, useEffect } from 'react';

const riskColors = {
  high: { bg: 'rgba(255, 61, 90, 0.15)', color: 'var(--danger)', label: 'HIGH RISK' },
  medium: { bg: 'rgba(255, 184, 54, 0.15)', color: 'var(--warning)', label: 'MEDIUM' },
  low: { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--success)', label: 'LOW' }
};

function ConfidenceBadge({ confidence }) {
  let color = 'var(--accent4)';
  let label = 'Low Confidence — Limited History';
  if (confidence >= 80) { color = 'var(--success)'; label = 'High Confidence'; }
  else if (confidence >= 50) { color = 'var(--warning)'; label = 'Moderate Confidence'; }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color,
      background: `${color}22`, padding: '2px 8px', borderRadius: 10
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {confidence}% — {label}
    </span>
  );
}

function SLAForecastPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/forecast/sla', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>Loading SLA forecasts...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>Failed to load SLA forecasts: {error}</div>
    </div>
  );

  if (!data || !data.forecasts) return null;

  const { forecasts, metadata } = data;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: 1 }}>
            SLA Forecast Engine
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
            PROJECTED PO COMPLETION VS SLA DEADLINES
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {['high', 'medium', 'low'].map(risk => (
            <span key={risk} style={{
              fontSize: 10, fontFamily: 'Share Tech Mono, monospace',
              padding: '3px 10px', borderRadius: 10,
              background: riskColors[risk].bg, color: riskColors[risk].color
            }}>
              {metadata[`${risk}Risk`]} {riskColors[risk].label}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['PO', 'STAGE', 'CURRENT AGE', 'EXPECTED COMPLETION', 'EXPECTED DELAY', 'DELAY PROBABILITY', 'SLA DATE', 'CONFIDENCE'].map(h => (
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
            {forecasts.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No open POs to forecast</td></tr>
            ) : (
              forecasts.map((f, i) => {
                const risk = riskColors[f.riskLevel] || riskColors.low;
                return (
                  <tr key={i} style={{ borderLeft: `3px solid ${risk.color}` }}>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 600 }}>{f.poNumber}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-secondary)' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace', background: 'rgba(178,75,255,0.15)', color: 'var(--accent6)' }}>{f.currentStage}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.elapsedDays}d</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.projectedCompletionDate}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: f.expectedDelay > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>+{f.expectedDelay}d</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: f.delayProbability > 70 ? 'var(--danger)' : 'var(--warning)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>{f.delayProbability}%</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.slaDate}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.5)' }}>
                      <ConfidenceBadge confidence={f.confidence} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Based on {metadata.historicalSamples} historical PO completions
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {metadata.totalOpenPOs} open POs analyzed
        </span>
      </div>
    </div>
  );
}

export default SLAForecastPanel;
