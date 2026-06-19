import React, { useState, useEffect } from 'react';

function BottleneckForecast() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/forecast/bottleneck', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>Loading bottleneck forecast...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>Failed to load: {error}</div>
    </div>
  );

  if (!data) return null;

  const { currentBottleneck, predictedNextBottleneck, metadata } = data;
  const maxQueue = Math.max(1, currentBottleneck.queue, predictedNextBottleneck.projectedQueue);

  let confColor = 'var(--accent4)';
  let confLabel = 'Low Confidence — Limited History';
  if (metadata.confidence >= 80) { confColor = 'var(--success)'; confLabel = 'High Confidence'; }
  else if (metadata.confidence >= 50) { confColor = 'var(--warning)'; confLabel = 'Moderate Confidence'; }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: 1 }}>
            Predictive Bottleneck Detection
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
            CURRENT VS PREDICTED BOTTLENECK AT +{metadata.projectionDays} DAYS
          </div>
        </div>
        <span style={{
          fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: confColor,
          background: `${confColor}22`, padding: '3px 10px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: confColor }} />
          {metadata.confidence}% — {confLabel}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Current Bottleneck */}
        <div style={{ padding: 24, borderRight: '1px solid var(--border)' }}>
          <div style={{
            fontSize: 10, letterSpacing: 2, color: 'var(--danger)', fontFamily: 'Share Tech Mono, monospace',
            fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />
            CURRENT BOTTLENECK
          </div>

          <div style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: 4
          }}>
            {currentBottleneck.stage}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 36, fontWeight: 700, color: 'var(--danger)' }}>
              {currentBottleneck.queue}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>items in queue</span>
          </div>

          <div style={{ height: 24, background: 'var(--bg-bar-empty)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              width: `${(currentBottleneck.queue / maxQueue) * 100}%`,
              height: '100%', borderRadius: 6,
              background: 'linear-gradient(90deg, var(--danger), #ff6b6b)',
              transition: 'width 0.8s ease',
              boxShadow: '0 0 12px rgba(255, 61, 90, 0.3)'
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 0.5 }}>THROUGHPUT TREND</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: 'var(--text-primary)', marginTop: 2 }}>
                {currentBottleneck.throughputTrend || '0.0/d'}
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 0.5 }}>QUEUE GROWTH</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: currentBottleneck.growthRate > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 2 }}>
                {currentBottleneck.growthRate > 0 ? '+' : ''}{currentBottleneck.growthRate}/d
              </div>
            </div>
          </div>
        </div>

        {/* Predicted Next Bottleneck */}
        <div style={{ padding: 24, background: 'rgba(0, 201, 255, 0.03)' }}>
          <div style={{
            fontSize: 10, letterSpacing: 2, color: 'var(--accent1)', fontFamily: 'Share Tech Mono, monospace',
            fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent1)', boxShadow: '0 0 8px var(--accent1)' }} />
            PREDICTED NEXT BOTTLENECK
          </div>

          <div style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: 4
          }}>
            {predictedNextBottleneck.stage}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 36, fontWeight: 700, color: 'var(--accent1)' }}>
              {predictedNextBottleneck.projectedQueue}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>projected items</span>
          </div>

          {predictedNextBottleneck.daysUntil > 0 && (
            <div style={{
              fontSize: 11, color: 'var(--warning)', fontFamily: 'Share Tech Mono, monospace',
              background: 'rgba(255, 184, 54, 0.1)', padding: '4px 10px', borderRadius: 6,
              display: 'inline-block', marginBottom: 10
            }}>
              ⚠ Expected in ~{predictedNextBottleneck.daysUntil} days
            </div>
          )}

          <div style={{ height: 24, background: 'var(--bg-bar-empty)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              width: `${(predictedNextBottleneck.projectedQueue / maxQueue) * 100}%`,
              height: '100%', borderRadius: 6,
              background: 'linear-gradient(90deg, var(--accent1), var(--accent2))',
              transition: 'width 0.8s ease',
              boxShadow: '0 0 12px rgba(0, 201, 255, 0.3)'
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 0.5 }}>PROJECTED DELAY</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: 'var(--warning)', marginTop: 2 }}>
                {predictedNextBottleneck.projectedDelay} days
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 0.5 }}>FORECAST CONFIDENCE</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: 'var(--accent1)', marginTop: 2 }}>
                {predictedNextBottleneck.confidence}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Based on {metadata.analysisWindowDays} days of historical flow data · Projecting {metadata.projectionDays} days ahead
        </span>
      </div>
    </div>
  );
}

export default React.memo(BottleneckForecast);

