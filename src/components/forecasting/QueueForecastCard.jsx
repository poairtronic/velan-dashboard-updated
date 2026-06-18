import React, { useState, useEffect } from 'react';

function QueueForecastCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/forecast/queue', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>Loading queue forecasts...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>Failed to load: {error}</div>
    </div>
  );

  if (!data || !data.forecasts) return null;

  const maxDays = Math.max(1, ...data.forecasts.flatMap(f => [f.bestDays || 0, f.expectedDays || 0, f.worstDays || 0]));

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: 1 }}>
          Queue Clearance Forecast
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
          BEST / EXPECTED / WORST CASE SCENARIOS
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.forecasts.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>No active queues to forecast</div>
        ) : (
          data.forecasts.map((f, i) => {
            let confColor = 'var(--accent4)';
            if (f.confidence >= 80) confColor = 'var(--success)';
            else if (f.confidence >= 50) confColor = 'var(--warning)';

            return (
              <div key={i} style={{
                background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14
              }}>
                {/* Stage header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{f.stage}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>Queue: {f.currentQueue}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {f.expectedClearanceDate && (
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                        Clear Date: {f.expectedClearanceDate}
                      </span>
                    )}
                    <span style={{
                      fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: confColor,
                      background: `${confColor}22`, padding: '2px 6px', borderRadius: 8
                    }}>
                      {f.confidence}%
                    </span>
                  </div>
                </div>

                {/* Three scenario bars */}
                {[
                  { label: 'BEST', days: f.bestDays, color: 'var(--success)', throughput: f.p90Throughput },
                  { label: 'EXPECTED', days: f.expectedDays, color: 'var(--warning)', throughput: f.medianThroughput },
                  { label: 'WORST', days: f.worstDays, color: 'var(--danger)', throughput: f.p10Throughput }
                ].map((scenario, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 60, fontSize: 9, fontFamily: 'Share Tech Mono, monospace',
                      color: scenario.color, fontWeight: 700
                    }}>{scenario.label}</span>
                    <div style={{ flex: 1, height: 18, background: 'var(--bg-bar-empty)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: scenario.days !== null ? `${Math.min(100, (scenario.days / maxDays) * 100)}%` : '100%',
                        height: '100%', borderRadius: 4,
                        background: scenario.days !== null ? scenario.color : 'var(--border)',
                        opacity: scenario.days !== null ? 0.7 : 0.3,
                        transition: 'width 0.8s ease'
                      }} />
                      <span style={{
                        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-primary)', fontWeight: 700
                      }}>
                        {scenario.days !== null ? `${scenario.days}d` : 'N/A'}
                      </span>
                    </div>
                    <span style={{ width: 50, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', textAlign: 'right' }}>
                      {scenario.throughput}/d
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Based on {data.metadata.basedOnDays} days of throughput history
        </span>
      </div>
    </div>
  );
}

export default QueueForecastCard;
