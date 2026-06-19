import React, { useState, useEffect } from 'react';

function ConfidenceBadge({ confidence, label, grade }) {
  let color = 'var(--accent4)';
  if (label === 'Very High') color = 'var(--success)';
  else if (label === 'High') color = '#00c9ff';
  else if (label === 'Medium') color = 'var(--warning)';
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color,
      background: `${color}22`, padding: '2px 6px', borderRadius: 8,
      display: 'inline-flex', alignItems: 'center', gap: 4
    }}>
      <span style={{ fontWeight: 700 }}>{grade}</span> {confidence}% {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    Critical: { color: '#ff3d8c', bg: 'rgba(255,61,140,0.15)', icon: '🔴' },
    High: { color: 'var(--danger)', bg: 'rgba(255,61,90,0.12)', icon: '🟠' },
    Medium: { color: 'var(--warning)', bg: 'rgba(255,184,54,0.12)', icon: '🟡' },
    Monitor: { color: 'var(--success)', bg: 'rgba(0,230,118,0.12)', icon: '🟢' }
  };
  const s = styles[priority] || styles.Monitor;
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: s.color,
      background: s.bg, padding: '2px 8px', borderRadius: 8, fontWeight: 700,
      border: `1px solid ${s.color}33`
    }}>
      {s.icon} {priority.toUpperCase()}
    </span>
  );
}

function CapacityPlanner() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('recommendations');

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

      {/* View Mode Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '0 10px' }}>
        {[
          { key: 'recommendations', label: '📊 RECOMMENDATIONS' },
          { key: 'projections', label: '📈 PROJECTIONS' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            style={{
              background: 'none', border: 'none',
              borderBottom: viewMode === tab.key ? '2px solid var(--accent1)' : '2px solid transparent',
              color: viewMode === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, padding: '8px 14px', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewMode === 'recommendations' ? (
        /* ═══ Recommendations View (Section 1) ═══ */
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['STAGE', 'QUEUE', 'CURRENT THROUGHPUT', 'REQUIRED THROUGHPUT', 'CAPACITY INCREASE', 'PRIORITY', 'RECOMMENDED ACTION', 'CONFIDENCE'].map(h => (
                  <th key={h} style={{
                    background: 'var(--bg-secondary)', padding: '10px 10px', textAlign: 'left',
                    fontSize: 9, letterSpacing: 1.2, color: 'var(--text-muted)',
                    fontFamily: 'Share Tech Mono, monospace', borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stages.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No active stages to analyze</td></tr>
              ) : (
                data.stages.map((s, i) => {
                  const increaseColor = s.capacityIncreasePercent > 50 ? '#ff3d8c' :
                    s.capacityIncreasePercent > 20 ? 'var(--danger)' :
                    s.capacityIncreasePercent > 10 ? 'var(--warning)' : 'var(--success)';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,92,0.3)' }}>
                      <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>{s.stage}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{s.currentQueue}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-secondary)' }}>{s.currentThroughput}/day</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)', fontWeight: 700 }}>{s.requiredThroughput}/day</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{
                          fontFamily: 'Share Tech Mono, monospace', fontWeight: 700, fontSize: 12, color: increaseColor,
                          background: `${increaseColor}15`, padding: '2px 8px', borderRadius: 6
                        }}>
                          {s.capacityIncreasePercent > 0 ? '+' : ''}{s.capacityIncreasePercent}%
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <PriorityBadge priority={s.priority} />
                      </td>
                      <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text-secondary)', maxWidth: 180 }}>{s.recommendedAction}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <ConfidenceBadge confidence={s.confidence} label={s.confidenceLabel} grade={s.confidenceGrade} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ═══ Projections View (original) ═══ */
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {data.stages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>No active stages to analyze</div>
          ) : (
            data.stages.map((s, i) => {
              const gapColor = s.capacityIncreasePercent > 50 ? '#ff3d8c' : s.capacityIncreasePercent > 20 ? 'var(--danger)' : s.capacityGapPercent > 20 ? 'var(--warning)' : 'var(--success)';
              return (
                <div key={i} style={{
                  background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14,
                  borderTop: `3px solid ${gapColor}`
                }}>
                  {/* Stage header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.stage}</span>
                    <ConfidenceBadge confidence={s.confidence} label={s.confidenceLabel} grade={s.confidenceGrade} />
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
                    { label: '+30D', value: s.projectedQueue30d, color: s.capacityIncreasePercent > 20 ? 'var(--danger)' : 'var(--accent3)' }
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

                  {/* Throughput & Capacity Recommendation */}
                  <div style={{ marginTop: 8, padding: '6px 8px', background: `${gapColor}11`, borderRadius: 6, border: `1px solid ${gapColor}33` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: gapColor, fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>
                        GAP: {s.capacityGapPercent > 0 ? '+' : ''}{s.capacityGapPercent}%
                      </span>
                      <PriorityBadge priority={s.priority} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        Current: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{s.currentThroughput}/d</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        Required: <span style={{ color: 'var(--accent1)', fontWeight: 700 }}>{s.requiredThroughput}/d</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'Share Tech Mono, monospace' }}>
                      {s.recommendedAction}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Based on {data.metadata.analysisWindowDays} days of historical inflow/outflow data · Target clearance: {data.metadata.targetClearanceDays}d
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {data.metadata.confidenceModel}
        </span>
      </div>
    </div>
  );
}

export default React.memo(CapacityPlanner);

