import React, { useState, useEffect } from 'react';

function ConfidenceBadge({ confidence }) {
  let color = 'var(--accent4)';
  let label = 'Low Confidence';
  if (confidence >= 80) { color = 'var(--success)'; label = 'High'; }
  else if (confidence >= 50) { color = 'var(--warning)'; label = 'Moderate'; }
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color,
      background: `${color}22`, padding: '2px 6px', borderRadius: 8
    }}>
      {confidence}% {label}
    </span>
  );
}

function CapacityPlanner() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/forecast/capacity', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>Loading capacity projections...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>Failed to load: {error}</div>
    </div>
  );

  if (!data || !data.stages) return null;

  const maxQueue = Math.max(1, ...data.stages.flatMap(s => [s.currentQueue, s.projectedQueue7d, s.projectedQueue14d, s.projectedQueue30d]));

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: 1 }}>
          Dynamic Capacity Planner
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
          QUEUE PROJECTIONS AT +7 / +14 / +30 DAYS
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {data.stages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>No active stages to analyze</div>
        ) : (
          data.stages.map((s, i) => {
            const gapColor = s.capacityGapPercent > 20 ? 'var(--danger)' : s.capacityGapPercent > 0 ? 'var(--warning)' : 'var(--success)';
            return (
              <div key={i} style={{
                background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14,
                borderTop: `3px solid ${gapColor}`
              }}>
                {/* Stage header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.stage}</span>
                  <ConfidenceBadge confidence={s.confidence} />
                </div>

                {/* Current queue */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>NOW</span>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: 'var(--text-primary)' }}>{s.currentQueue}</span>
                </div>

                {/* Projection bars */}
                {[
                  { label: '+7D', value: s.projectedQueue7d, color: 'var(--accent1)' },
                  { label: '+14D', value: s.projectedQueue14d, color: 'var(--warning)' },
                  { label: '+30D', value: s.projectedQueue30d, color: s.capacityGapPercent > 20 ? 'var(--danger)' : 'var(--accent3)' }
                ].map((p, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 30, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>{p.label}</span>
                    <div style={{ flex: 1, height: 14, background: 'var(--bg-bar-empty)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, (p.value / maxQueue) * 100)}%`,
                        height: '100%', borderRadius: 3, background: p.color,
                        transition: 'width 0.8s ease'
                      }} />
                    </div>
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-secondary)' }}>{p.value}</span>
                  </div>
                ))}

                {/* Gap & Action */}
                <div style={{ marginTop: 8, padding: '6px 8px', background: `${gapColor}11`, borderRadius: 6, border: `1px solid ${gapColor}33` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: gapColor, fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>
                      GAP: {s.capacityGapPercent > 0 ? '+' : ''}{s.capacityGapPercent}%
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                      ↑{s.avgInflowPerDay}/d ↓{s.avgOutflowPerDay}/d
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{s.recommendedAction}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Based on {data.metadata.analysisWindowDays} days of historical inflow/outflow data
        </span>
      </div>
    </div>
  );
}

export default CapacityPlanner;
