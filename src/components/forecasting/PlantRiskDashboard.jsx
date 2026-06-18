import React, { useState, useEffect } from 'react';

const riskBandColors = {
  Critical: { color: '#ff3d8c', bg: 'rgba(255,61,140,0.15)', glow: 'rgba(255,61,140,0.3)' },
  High: { color: 'var(--danger)', bg: 'rgba(255,61,90,0.12)', glow: 'rgba(255,61,90,0.2)' },
  Moderate: { color: 'var(--warning)', bg: 'rgba(255,184,54,0.12)', glow: 'rgba(255,184,54,0.2)' },
  Low: { color: 'var(--success)', bg: 'rgba(0,230,118,0.12)', glow: 'rgba(0,230,118,0.2)' }
};

function RiskGauge({ score, band, size = 120 }) {
  const colors = riskBandColors[band] || riskBandColors.Low;
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference * 0.75; // 270 degree arc

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" style={{ transform: 'rotate(135deg)' }}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="6"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={colors.color} strokeWidth="6"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${colors.glow})`, transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -45%)',
        textAlign: 'center'
      }}>
        <div style={{
          fontFamily: 'Rajdhani, sans-serif', fontSize: size * 0.3, fontWeight: 700,
          color: colors.color, lineHeight: 1
        }}>{score}</div>
        <div style={{
          fontFamily: 'Share Tech Mono, monospace', fontSize: size * 0.08,
          color: colors.color, letterSpacing: 1, fontWeight: 700, marginTop: 2
        }}>{band.toUpperCase()}</div>
      </div>
    </div>
  );
}

function RiskComponentBar({ name, score, contribution, weight }) {
  const barColor = score >= 75 ? '#ff3d8c' : score >= 50 ? 'var(--danger)' : score >= 25 ? 'var(--warning)' : 'var(--success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 100, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', whiteSpace: 'nowrap' }}>
        {name.replace(' Risk', '')}
      </span>
      <div style={{ flex: 1, height: 14, background: 'var(--bg-bar-empty)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${Math.min(100, score)}%`, height: '100%', borderRadius: 3,
          background: barColor, opacity: 0.7, transition: 'width 0.8s ease'
        }} />
        <span style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-primary)', fontWeight: 700
        }}>{score}</span>
      </div>
      <span style={{ width: 30, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', textAlign: 'right' }}>
        {Math.round(weight * 100)}%
      </span>
    </div>
  );
}

function ExecutiveRiskTable({ title, risks, icon }) {
  if (!risks || risks.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700,
        color: 'var(--text-primary)', letterSpacing: 1, marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <span>{icon}</span> {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['RISK', 'SCORE', 'CONFIDENCE', 'POs', 'SCs', 'EXPECTED IMPACT'].map(h => (
              <th key={h} style={{
                padding: '6px 8px', textAlign: 'left', fontSize: 8, letterSpacing: 1,
                color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace',
                borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {risks.map((r, i) => {
            const scoreColor = r.riskScore >= 75 ? '#ff3d8c' : r.riskScore >= 50 ? 'var(--danger)' : r.riskScore >= 25 ? 'var(--warning)' : 'var(--success)';
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,92,0.2)' }}>
                <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, maxWidth: 200 }}>{r.riskName}</td>
                <td style={{ padding: '7px 8px' }}>
                  <span style={{
                    fontFamily: 'Share Tech Mono, monospace', fontSize: 10, fontWeight: 700,
                    color: scoreColor, background: `${scoreColor}15`, padding: '1px 6px', borderRadius: 4
                  }}>{r.riskScore}%</span>
                </td>
                <td style={{ padding: '7px 8px', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-secondary)' }}>{r.confidence}%</td>
                <td style={{ padding: '7px 8px', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-secondary)' }}>{r.affectedPOs}</td>
                <td style={{ padding: '7px 8px', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-secondary)' }}>{r.affectedSCs}</td>
                <td style={{ padding: '7px 8px', fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)', maxWidth: 220 }}>{r.expectedImpact}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlantRiskDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/forecast/plant-risk', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>Calculating plant risk aggregation...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>Failed to load: {error}</div>
    </div>
  );

  if (!data || !data.plantRisk) return null;

  const { plantRisk, executiveSummary, metadata } = data;
  const bandStyle = riskBandColors[plantRisk.band] || riskBandColors.Low;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: 1 }}>
            Plant Risk Intelligence
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
            AGGREGATED OPERATIONAL RISK ASSESSMENT
          </div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 10, fontFamily: 'Share Tech Mono, monospace',
          fontSize: 11, fontWeight: 700, color: bandStyle.color, background: bandStyle.bg,
          border: `1px solid ${bandStyle.color}44`, boxShadow: `0 0 12px ${bandStyle.glow}`
        }}>
          PLANT RISK: {plantRisk.score} — {plantRisk.band.toUpperCase()}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '0 10px' }}>
        {[
          { key: 'overview', label: '🏭 RISK OVERVIEW' },
          { key: 'executive', label: '📋 EXECUTIVE SUMMARY' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent1)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, padding: '8px 14px', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        /* ═══ Risk Overview ═══ */
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 20, alignItems: 'center' }}>
            {/* Gauge */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RiskGauge score={plantRisk.score} band={plantRisk.band} />
            </div>

            {/* Risk Components */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
                RISK COMPONENTS
              </div>
              {plantRisk.components.map((c, i) => (
                <RiskComponentBar key={i} name={c.name} score={c.score} contribution={c.contribution} weight={c.weight} />
              ))}
            </div>

            {/* Primary & Secondary Drivers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card2)',
                border: '1px solid var(--border)', borderLeft: `3px solid ${bandStyle.color}`
              }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1, marginBottom: 4 }}>
                  PRIMARY RISK DRIVER
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: bandStyle.color }}>
                  {plantRisk.primaryDriver.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
                  Score: {plantRisk.primaryDriver.score} · Contribution: {plantRisk.primaryDriver.contribution}pts
                </div>
              </div>
              <div style={{
                padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card2)',
                border: '1px solid var(--border)', borderLeft: '3px solid var(--accent1)'
              }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1, marginBottom: 4 }}>
                  SECONDARY RISK DRIVER
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: 'var(--accent1)' }}>
                  {plantRisk.secondaryDriver.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
                  Score: {plantRisk.secondaryDriver.score} · Contribution: {plantRisk.secondaryDriver.contribution}pts
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ Executive Summary (Section 5) ═══ */
        <div style={{ padding: 16, maxHeight: 500, overflowY: 'auto' }}>
          <ExecutiveRiskTable title="TOP PLANT RISKS" risks={executiveSummary.topPlantRisks} icon="🏭" />
          <ExecutiveRiskTable title="TOP CAPACITY RISKS" risks={executiveSummary.topCapacityRisks} icon="📊" />
          <ExecutiveRiskTable title="TOP DELAY RISKS" risks={executiveSummary.topDelayRisks} icon="⏱" />
          <ExecutiveRiskTable title="TOP VENDOR RISKS" risks={executiveSummary.topVendorRisks} icon="🏢" />
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {metadata.totalPOs} POs · {metadata.totalSCs} SCs · {metadata.totalItems} items analyzed
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {metadata.weightModel}
        </span>
      </div>
    </div>
  );
}

export default PlantRiskDashboard;
