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
  const [activeTab, setActiveTab] = useState('forecast');
  const [expandedPo, setExpandedPo] = useState(null);

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

  const toggleExpand = (poNumber) => {
    if (expandedPo === poNumber) {
      setExpandedPo(null);
    } else {
      setExpandedPo(poNumber);
    }
  };

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

      {/* Sub-header Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '0 10px' }}>
        <button
          onClick={() => setActiveTab('forecast')}
          style={{
            background: 'none', border: 'none', borderBottom: activeTab === 'forecast' ? '2px solid var(--accent1)' : '2px solid transparent',
            color: activeTab === 'forecast' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, padding: '10px 16px', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          📊 SLA PROJECTIONS
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          style={{
            background: 'none', border: 'none', borderBottom: activeTab === 'comparison' ? '2px solid var(--accent1)' : '2px solid transparent',
            color: activeTab === 'comparison' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, padding: '10px 16px', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          🔍 MODEL COMPARISON & VALIDATION
        </button>
      </div>

      {activeTab === 'forecast' ? (
        /* Table View */
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
                  const isExpanded = expandedPo === f.poNumber;
                  return (
                    <React.Fragment key={i}>
                      <tr
                        onClick={() => toggleExpand(f.poNumber)}
                        style={{
                          borderLeft: `3px solid ${risk.color}`,
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(0, 201, 255, 0.04)' : 'transparent',
                          transition: 'background 0.2s'
                        }}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 600 }}>
                          {f.poNumber} <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-secondary)' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace', background: 'rgba(178,75,255,0.15)', color: 'var(--accent6)' }}>{f.currentStage}</span>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.elapsedDays}d</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.projectedCompletionDate}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: f.expectedDelay > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>+{f.expectedDelay}d</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: f.delayProbability > 70 ? 'var(--danger)' : 'var(--warning)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>{f.delayProbability}%</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.slaDate}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(26,58,92,0.3)' }}>
                          <ConfidenceBadge confidence={f.confidence} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: 'rgba(0, 201, 255, 0.02)' }}>
                          <td colSpan={8} style={{ padding: '16px 20px', borderBottom: '1px solid rgba(26,58,92,0.5)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                              {/* Parameters */}
                              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: 'var(--accent1)' }}>⚙</span> CALCULATION METRICS (NEW MODEL)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11, fontFamily: 'Share Tech Mono, monospace' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Historical Velocity:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{f.projectedTotalDays} days</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Elapsed Days:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{f.elapsedDays} days</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Queue Impact Factor:</span>
                                    <span style={{ color: 'var(--warning)' }}>+{Math.round((f.newModel?.queueImpact || 0) * 100)}%</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Adjusted Duration:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{f.newModel?.adjustedDuration} days</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Remaining Days:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{f.newModel?.remainingDays} days</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Forecast Confidence:</span>
                                    <span style={{ color: 'var(--success)' }}>{f.confidence}%</span>
                                  </div>
                                </div>
                              </div>

                              {/* Old vs New Model Comparison */}
                              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: 'var(--accent1)' }}>🔄</span> MODEL COMPARISON
                                </div>
                                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', fontFamily: 'Share Tech Mono, monospace' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Metric</th>
                                      <th style={{ textAlign: 'right', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Old Model</th>
                                      <th style={{ textAlign: 'right', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>New Refined</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>Remaining</td>
                                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{f.oldModel?.remainingDays}d</td>
                                      <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>{f.newModel?.remainingDays}d</td>
                                    </tr>
                                    <tr>
                                      <td style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>Completion</td>
                                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 10 }}>{f.oldModel?.projectedCompletionDate}</td>
                                      <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 10 }}>{f.newModel?.projectedCompletionDate}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>Delay</td>
                                      <td style={{ textAlign: 'right', color: f.oldModel?.expectedDelay > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>+{f.oldModel?.expectedDelay}d</td>
                                      <td style={{ textAlign: 'right', color: f.newModel?.expectedDelay > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>+{f.newModel?.expectedDelay}d</td>
                                    </tr>
                                    <tr>
                                      <td style={{ padding: '6px 0' }}>Risk Level</td>
                                      <td style={{ textAlign: 'right', color: riskColors[f.oldModel?.riskLevel]?.color }}>{f.oldModel?.riskLevel?.toUpperCase()}</td>
                                      <td style={{ textAlign: 'right', color: riskColors[f.newModel?.riskLevel]?.color, fontWeight: 'bold' }}>{f.newModel?.riskLevel?.toUpperCase()}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Comparison View */
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['PO', 'HIST VELOCITY', 'ELAPSED', 'OLD MODEL (REM / DELAY)', 'NEW REFINED (REM / DELAY)', 'REDUCTION'].map(h => (
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
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No open POs to compare</td></tr>
              ) : (
                forecasts.map((f, i) => {
                  const reduction = (f.oldModel?.remainingDays || 0) - (f.newModel?.remainingDays || 0);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,92,0.3)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 600 }}>{f.poNumber}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.projectedTotalDays}d</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{f.elapsedDays}d</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        {f.oldModel?.remainingDays}d / +{f.oldModel?.expectedDelay}d
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>
                        {f.newModel?.remainingDays}d / +{f.newModel?.expectedDelay}d
                      </td>
                      <td style={{ padding: '10px 12px', color: reduction > 0 ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>
                        {reduction > 0 ? `-${reduction}d (Refined)` : '0d (No Change)'}
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
          Based on {metadata.historicalSamples} historical PO completions
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {metadata.totalOpenPOs} open POs analyzed
        </span>
      </div>
    </div>
  );
}

export default React.memo(SLAForecastPanel);

