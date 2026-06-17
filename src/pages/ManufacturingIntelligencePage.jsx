import React, { useState, useRef } from 'react';
import { useFilters } from '../context/FilterContext';
import { useTheme } from '../context/ThemeContext';
import useMicDataQuery from '../hooks/useMicDataQuery';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import useChart from '../utils/chartUtils';
import LoadingScreen from '../components/LoadingScreen';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import KPICard from '../components/KPICard';
import { 
  Activity, TrendingUp, TrendingDown, Target, Zap, 
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Info, CheckCircle2
} from 'lucide-react';

// --- Shared Components ---

const TrendBadge = ({ trend, variance, suffix = '%' }) => {
  if (trend === 'Stable') return <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}><Minus size={12} /> Stable</span>;
  if (trend === 'Improving') return <span style={{ color: 'var(--success)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}><ArrowUpRight size={12} /> +{variance}{suffix}</span>;
  return <span style={{ color: 'var(--danger)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}><ArrowDownRight size={12} /> {variance}{suffix}</span>;
};

// --- Modules ---

function PlantHealthSection({ data }) {
  const renderCard = (title, metric, color, sub, icon) => (
    <div style={{ background: 'var(--bg-secondary)', border: `1px solid var(--border)`, padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>{title}</div>
        {icon}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <div style={{ fontSize: '32px', fontWeight: 'bold', fontFamily: 'Rajdhani', color, lineHeight: 1 }}>{metric.current}</div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ 100</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</span>
        <TrendBadge trend={metric.trend} variance={metric.variance} />
      </div>
    </div>
  );

  const getHealthColor = (score) => score >= 80 ? 'var(--success)' : (score >= 60 ? 'var(--warning)' : 'var(--danger)');

  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-title">Plant Health Score V2</div>
      <div className="chart-sub">WEIGHTED AGGREGATE OF PRODUCTION CAPABILITIES</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
        {renderCard('Overall Health', data.overall, getHealthColor(data.overall.current), 'Composite Score', <Activity size={16} color={getHealthColor(data.overall.current)} />)}
        {renderCard('Production', data.production, 'var(--accent1)', 'Throughput Stability', <Zap size={16} color="var(--accent1)" />)}
        {renderCard('Delivery', data.delivery, 'var(--success)', 'SLA Compliance', <CheckCircle2 size={16} color="var(--success)" />)}
        {renderCard('Vendor', data.vendor, 'var(--accent2)', 'External Performance', <Target size={16} color="var(--accent2)" />)}
        {renderCard('Inventory', data.inventory, '#b24bff', 'Stock Velocity', <ArrowUpRight size={16} color="#b24bff" />)}
        {renderCard('Flow', data.flow, 'var(--warning)', 'Bottleneck Severity', <AlertTriangle size={16} color="var(--warning)" />)}
      </div>
    </div>
  );
}

function ThroughputSection({ data }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'bar',
    data: {
      labels: data.dailyTrend.map(d => d.date.slice(5)), // MM-DD
      datasets: [{
        label: 'Daily Output',
        data: data.dailyTrend.map(d => d.count),
        backgroundColor: 'rgba(0, 201, 255, 0.4)',
        borderColor: '#00c9ff',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  }, [data]);

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Throughput Intelligence</div>
      <div className="chart-sub">VELOCITY & OUTPUT TRENDS</div>
      <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flex: 1 }}>
        <div style={{ flex: 2, minHeight: '200px', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>WEEKLY OUTPUT</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{data.weekly.current}</span>
              <TrendBadge trend={data.weekly.trend} variance={data.weekly.variance} />
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MONTHLY OUTPUT</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{data.monthly.current}</span>
              <TrendBadge trend={data.monthly.trend} variance={data.monthly.variance} />
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>TOP STAGES</div>
            {data.bestStages.slice(0, 3).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Share Tech Mono', marginBottom: '2px' }}>
                <span style={{ color: 'var(--accent1)' }}>{s.stage}</span>
                <span>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueClearanceSection({ data }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Queue Clearance Forecast</div>
      <div className="chart-sub">HISTORICAL THROUGHPUT ANALYSIS</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Stage</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Queue</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Avg/Day</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Days To Clear</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.map((q, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{q.stage}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{q.queueSize}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{q.avgDailyThroughput}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: q.daysToClear > 10 ? 'var(--danger)' : 'var(--text-primary)' }}>{q.daysToClear}d</td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                    background: q.risk === 'High' ? 'rgba(239, 68, 68, 0.1)' : (q.risk === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                    color: q.risk === 'High' ? '#ef4444' : (q.risk === 'Medium' ? '#f59e0b' : '#10b981')
                  }}>{q.risk}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PredictiveDelayEngine({ data, onDrillDown }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Advanced Predictive Delay</span>
        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
          {data.length} At Risk
        </span>
      </div>
      <div className="chart-sub">PROBABILISTIC CYCLE TIME FORECAST</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>PO</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Age</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Exp Delay</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Probability</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No predictions to display.</td></tr>
            ) : (
              data.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => onDrillDown('PO', p.po)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 8px', color: 'var(--accent1)', fontWeight: 'bold', fontFamily: 'Share Tech Mono' }}>{p.po}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{p.currentAge}d</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--danger)' }}>+{p.expectedDelay}d</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--danger)', fontWeight: 'bold' }}>{p.probability}%</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.confidence}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RootCauseImpactSection({ data }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Root Cause Impact Analysis</div>
      <div className="chart-sub">AFFECTED REVENUE & VOLUME</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Category</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Aff. POs</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Delay Days</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Impact Score</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.cause}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{r.affectedPOs}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--warning)' }}>{r.totalDelayDays}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)', fontWeight: 'bold' }}>{r.impactScore}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                    background: r.riskRating === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : (r.riskRating === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
                    color: r.riskRating === 'Critical' ? '#ef4444' : (r.riskRating === 'High' ? '#ef4444' : '#f59e0b')
                  }}>{r.riskRating}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorIntelligenceSection({ data, onDrillDown }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Vendor Intelligence V2</div>
      <div className="chart-sub">THROUGHPUT & SLA PERFORMANCE</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Vendor</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Output/m</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Avg Cycle</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>SLA Perf</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Risk Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => onDrillDown('Vendor', v.vendor)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 8px', color: 'var(--accent1)', fontWeight: 'bold' }}>{v.vendor}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{v.throughput}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: v.avgCycleTime > 21 ? 'var(--danger)' : 'var(--text-primary)' }}>{v.avgCycleTime}d</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: v.slaPerformance < 80 ? 'var(--warning)' : 'var(--success)' }}>{v.slaPerformance}%</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{v.riskScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryIntelligenceSection({ data }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'bar',
    data: {
      labels: data.breakdown.map(b => b.stage),
      datasets: [{
        label: 'Average Age (Days)',
        data: data.breakdown.map(b => b.avgAge),
        backgroundColor: [
          'rgba(239, 68, 68, 0.6)', 
          'rgba(245, 158, 11, 0.6)',
          'rgba(16, 185, 129, 0.6)',
        ],
        borderColor: ['#ef4444', '#f59e0b', '#10b981'],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  }, [data]);

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Inventory Intelligence V2</div>
      <div className="chart-sub">VELOCITY & AGING ANALYSIS</div>
      <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flex: 1 }}>
        <div style={{ flex: 1, minHeight: '200px', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HEALTH SCORE</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--success)', fontFamily: 'Rajdhani' }}>{data.healthScore}</span>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>VELOCITY (items/day)</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent1)', fontFamily: 'Share Tech Mono' }}>{data.velocity}</span>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DEAD INVENTORY</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--danger)', fontFamily: 'Share Tech Mono' }}>{data.deadInventory}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BottleneckImpactSection({ data }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Bottleneck Impact Analysis</div>
      <div className="chart-sub">AFFECTED VOLUME & EXPECTED DELAYS</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Stage</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Severity</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Aff. POs</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Queue</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Exp. Delay</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{b.stage}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--danger)', fontWeight: 'bold' }}>{b.severityScore}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{b.affectedPOs}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--warning)' }}>{b.queueSize}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>+{b.expectedDelayDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionCenterSection({ data }) {
  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Target size={18} color="var(--accent1)" /> Executive Action Center V2
      </div>
      <div className="chart-sub">DYNAMIC RECOMMENDATIONS & ESTIMATED IMPACT</div>
      <div style={{ marginTop: '15px', overflowX: 'auto', padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Priority</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Recommended Action</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Expected Benefit</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Aff. POs</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Est. KPI Imprv</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Delay Reduction</th>
            </tr>
          </thead>
          <tbody>
            {data.map((act, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                    background: act.priority === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : (act.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : (act.priority === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)')),
                    color: act.priority === 'Critical' || act.priority === 'High' ? '#ef4444' : (act.priority === 'Medium' ? '#f59e0b' : '#10b981')
                  }}>{act.priority}</span>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{act.action}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{act.reason}</div>
                </td>
                <td style={{ padding: '12px 8px', color: 'var(--accent2)', fontWeight: 'bold' }}>{act.benefit}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{act.affectedPOs}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>{act.kpiImprovement}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--danger)' }}>{act.delayReduction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ManufacturingIntelligencePage() {
  const { data: micData, isLoading, error } = useMicDataQuery();
  const { filters } = useFilters();
  const { theme } = useTheme();
  const { rows: allRows, isLoading: rowsLoading } = useProductionDataQuery({ ...filters, source: 'database' }, 1, 200000);
  const [drillDown, setDrillDown] = useState(null);

  if (isLoading) return <LoadingScreen message="Loading Decision Engine..." />;
  if (error) return <div className="page-container p-6"><div className="card text-center p-8"><h2 className="text-2xl text-accent-red mb-4">Error Loading Data</h2><p>{error.message}</p></div></div>;
  if (!micData) return null;

  const handleDrillDown = (type, value) => {
    if (!allRows) return;
    let filteredRows = [];
    if (type === 'PO') {
      filteredRows = allRows.filter(r => r.po === value);
    } else if (type === 'Vendor') {
      filteredRows = allRows.filter(r => {
        if (r.inhouse !== 'VENDOR') return false;
        const code = r.currentStage && r.currentStage.endsWith('V') ? r.currentStage.slice(0, -1) : 'EXT';
        return code === value;
      });
    }
    setDrillDown({ title: `${type}: ${value}`, data: filteredRows });
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          Manufacturing <span>Intelligence Center</span>
          <div className="section-line" />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
          Phase 9.2 Decision Engine
        </div>
      </div>

      {/* SECTION 1: PLANT HEALTH V2 */}
      <div className="chart-grid" style={{ marginBottom: '20px' }}>
        <PlantHealthSection data={micData.plantHealth} />
      </div>

      {/* SECTION 2 & 7: THROUGHPUT & INVENTORY */}
      <div className="chart-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', marginBottom: '20px' }}>
        <ThroughputSection data={micData.throughput} />
        <InventoryIntelligenceSection data={micData.inventory} />
      </div>

      {/* SECTION 3, 4 & 5: QUEUE, DELAY, ROOT CAUSE */}
      <div className="chart-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', marginBottom: '20px' }}>
        <QueueClearanceSection data={micData.queueClearance} />
        <PredictiveDelayEngine data={micData.predictions} onDrillDown={handleDrillDown} />
        <RootCauseImpactSection data={micData.rootCauseImpact} />
      </div>

      {/* SECTION 6 & 8: VENDOR RISK & BOTTLENECK IMPACT */}
      <div className="chart-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', marginBottom: '20px' }}>
        <VendorIntelligenceSection data={micData.vendorRisk} onDrillDown={handleDrillDown} />
        <BottleneckImpactSection data={micData.bottleneckImpact} />
      </div>

      {/* SECTION 9: EXECUTIVE ACTION CENTER V2 */}
      <div className="chart-grid">
        <ActionCenterSection data={micData.actions} />
      </div>

      {/* SECTION 10: DRILL-DOWN INTELLIGENCE */}
      {drillDown && (
        <Modal isOpen={true} onClose={() => setDrillDown(null)} title={`Drill Down: ${drillDown.title}`} maxWidth="90%" lightMode={theme === 'light'}>
          <div style={{ maxHeight: '60vh', overflow: 'auto', paddingRight: '5px' }}>
            {rowsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
            ) : (
              <DataTable
                headers={['PO', 'SC', 'Product', 'Stage', 'Vendor', 'Timestamp']}
                isEmpty={!drillDown.data || drillDown.data.length === 0}
                lightMode={theme === 'light'}
              >
                {drillDown.data && drillDown.data.slice(0, 200).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--accent1)', fontWeight: 'bold' }}>{r.po || '—'}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{r.sc || '—'}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{r.product || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.currentStage || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{r.inhouse === 'VENDOR' ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', fontSize: '11px', color: 'var(--text-muted)' }}>{r.timestamp ? r.timestamp.slice(0, 10) : '—'}</td>
                  </tr>
                ))}
                {drillDown.data && drillDown.data.length > 200 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>Showing top 200 records. Please use the Database page for the complete list.</td>
                  </tr>
                )}
              </DataTable>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
