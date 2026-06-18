import React, { useState, useEffect } from 'react';

function ConfidenceGradeBadge({ confidence, label, grade }) {
  let color = 'var(--accent4)';
  if (label === 'Very High') color = 'var(--success)';
  else if (label === 'High') color = '#00c9ff';
  else if (label === 'Medium') color = 'var(--warning)';
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color,
      background: `${color}22`, padding: '2px 6px', borderRadius: 8,
      display: 'inline-flex', alignItems: 'center', gap: 3
    }}>
      <span style={{ fontWeight: 700 }}>{grade}</span> {confidence}% {label}
    </span>
  );
}

function ForecastUnavailableCard({ forecast }) {
  const statusColors = {
    unavailable: { color: 'var(--danger)', bg: 'rgba(255,61,90,0.08)', icon: '⚠' },
    low_confidence: { color: 'var(--warning)', bg: 'rgba(255,184,54,0.08)', icon: '⚡' }
  };
  const s = statusColors[forecast.forecastStatus] || statusColors.unavailable;

  return (
    <div style={{
      background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14,
      borderLeft: `3px solid ${s.color}`
    }}>
      {/* Stage header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{forecast.stage}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>Queue: {forecast.currentQueue}</span>
        </div>
        <ConfidenceGradeBadge confidence={forecast.confidence} label={forecast.confidenceLabel} grade={forecast.confidenceGrade} />
      </div>

      {/* Unavailability Message */}
      <div style={{
        padding: '10px 12px', borderRadius: 6, background: s.bg,
        border: `1px solid ${s.color}33`
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: s.color,
          fontFamily: 'Rajdhani, sans-serif', letterSpacing: 0.5, marginBottom: 6
        }}>
          {s.icon} {forecast.forecastMessage}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace', lineHeight: 1.5 }}>
          {forecast.forecastReason}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            DATA COVERAGE: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{forecast.dataCoverage}%</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            SAMPLE SIZE: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{forecast.sampleSize} events</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const availableForecasts = data.forecasts.filter(f => f.forecastStatus === 'available');
  const unavailableForecasts = data.forecasts.filter(f => f.forecastStatus !== 'available');
  const maxDays = Math.max(1, ...availableForecasts.flatMap(f => [f.bestDays || 0, f.expectedDays || 0, f.worstDays || 0]));

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
          <>
            {/* Available forecasts with scenario bars */}
            {availableForecasts.map((f, i) => (
              <div key={`avail-${i}`} style={{
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
                    <ConfidenceGradeBadge confidence={f.confidence} label={f.confidenceLabel} grade={f.confidenceGrade} />
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
                        {scenario.days !== null ? `${scenario.days}d` : '—'}
                      </span>
                    </div>
                    <span style={{ width: 50, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', textAlign: 'right' }}>
                      {scenario.throughput}/d
                    </span>
                  </div>
                ))}

                {/* Data coverage indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                    Coverage: {f.dataCoverage}% · {f.sampleSize} events
                  </span>
                  {f.forecastStatus === 'low_confidence' && (
                    <span style={{ fontSize: 9, color: 'var(--warning)', fontFamily: 'Share Tech Mono, monospace' }}>
                      ⚡ Low confidence — treat as estimate
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Unavailable forecasts with descriptive messaging */}
            {unavailableForecasts.map((f, i) => (
              <ForecastUnavailableCard key={`unavail-${i}`} forecast={f} />
            ))}
          </>
        )}
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Based on {data.metadata.basedOnDays} days of throughput history
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {data.metadata.confidenceModel}
        </span>
      </div>
    </div>
  );
}

export default QueueForecastCard;
