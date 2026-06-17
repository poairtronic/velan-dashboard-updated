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
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Zap
} from 'lucide-react';

// --- Modules ---

function ProductionEfficiency({ data }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'bar',
    data: {
      labels: ['Planned vs Actual'],
      datasets: [
        {
          label: 'Planned',
          data: [data.efficiency.planned],
          backgroundColor: 'rgba(0, 201, 255, 0.6)',
          borderColor: '#00c9ff',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Actual',
          data: [data.efficiency.actual],
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  }, [data]);

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Efficiency Intelligence</div>
      <div className="chart-sub">PLANNED VS ACTUAL OUTPUT</div>
      <div style={{ display: 'flex', gap: '15px', padding: '15px', flex: 1 }}>
        <div style={{ flex: 2, minHeight: '200px', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'Share Tech Mono' }}>GAP ANALYSIS</div>
            <div style={{ color: 'var(--danger)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'Rajdhani' }}>
              {data.efficiency.gap > 0 ? `-${data.efficiency.gap}` : 'On Track'}
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'Share Tech Mono' }}>EFFICIENCY</div>
            <div style={{ color: 'var(--accent1)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'Rajdhani' }}>
              {data.efficiency.efficiencyPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RootCauseAnalytics({ data }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'doughnut',
    data: {
      labels: data.rootCause.map(r => r.cause),
      datasets: [{
        data: data.rootCause.map(r => r.contribution),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)', // red
          'rgba(245, 158, 11, 0.8)', // yellow
          'rgba(16, 185, 129, 0.8)', // green
          'rgba(0, 201, 255, 0.8)', // blue
        ],
        borderColor: 'transparent',
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right' }
      }
    }
  }, [data]);

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Root Cause Analytics</div>
      <div className="chart-sub">PRODUCTION DELAY FACTORS</div>
      <div className="chart-wrap" style={{ minHeight: '220px', position: 'relative' }}>
        <canvas ref={chartRef}></canvas>
        <div style={{ position: 'absolute', top: '50%', left: '33%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Delays</div>
           <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'Rajdhani', color: 'var(--text-primary)' }}>
             {data.rootCause.reduce((a, b) => a + (b.count || 0), 0)}
           </div>
        </div>
      </div>
    </div>
  );
}

function InventoryIntelligence({ data }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'bar',
    data: {
      labels: data.inventory.breakdown.map(b => b.category),
      datasets: [{
        label: 'Items',
        data: data.inventory.breakdown.map(b => b.count),
        backgroundColor: [
          'rgba(239, 68, 68, 0.6)', // Dead (Red)
          'rgba(245, 158, 11, 0.6)', // Slow (Yellow)
          'rgba(16, 185, 129, 0.6)', // Fast (Green)
        ],
        borderColor: [
          '#ef4444',
          '#f59e0b',
          '#10b981'
        ],
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
      <div className="chart-title">Inventory Intelligence</div>
      <div className="chart-sub">STOCK MOVEMENT ANALYSIS</div>
      <div className="chart-wrap" style={{ minHeight: '220px' }}>
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
}

function PredictiveDelayEngine({ data, onDrillDown }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Predictive Delay Engine</span>
        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
          {data.predictions.length} At Risk
        </span>
      </div>
      <div className="chart-sub">FORECASTED SLA BREACHES</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>PO</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Age</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Delay</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Forecast</th>
            </tr>
          </thead>
          <tbody>
            {data.predictions.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No predictions to display.</td></tr>
            ) : (
              data.predictions.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => onDrillDown('PO', p.po)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 8px', color: 'var(--accent1)', fontWeight: 'bold', fontFamily: 'Share Tech Mono' }}>{p.po}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{p.currentAge}d</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'Share Tech Mono', color: 'var(--danger)' }}>+{p.expectedDelay}d</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>{p.expectedCompletion}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapacityPlanningEngine({ data }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Capacity Planning Engine</div>
      <div className="chart-sub">QUEUE LOAD & UTILIZATION</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Stage</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Queue</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Utilization</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.capacity.slice(0, 6).map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.stage}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{c.queue}/{c.capacity}</td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <div style={{ width: '50px', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, c.utilization)}%`, background: c.utilization > 80 ? '#ef4444' : (c.utilization > 50 ? '#f59e0b' : '#10b981') }} />
                    </div>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: '11px', color: 'var(--text-muted)' }}>{c.utilization}%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                    background: c.riskLevel === 'High' ? 'rgba(239, 68, 68, 0.1)' : (c.riskLevel === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                    color: c.riskLevel === 'High' ? '#ef4444' : (c.riskLevel === 'Medium' ? '#f59e0b' : '#10b981')
                  }}>{c.riskLevel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorRiskIntelligence({ data, onDrillDown }) {
  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-title">Vendor Risk Intelligence</div>
      <div className="chart-sub">EXTERNAL BOTTLENECK PROBABILITY</div>
      <div style={{ marginTop: '15px', overflowY: 'auto', flex: 1, padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Vendor</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Items</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Avg Days</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.vendorRisk.slice(0, 6).map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => onDrillDown('Vendor', v.vendor)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 8px', color: 'var(--accent1)', fontWeight: 'bold' }}>{v.vendor}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{v.count}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--warning)' }}>{v.avgDays}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  {v.trend === 'Declining' ? <TrendingDown size={16} color="var(--danger)" style={{ margin: '0 auto' }} /> : 
                  (v.trend === 'Improving' ? <TrendingUp size={16} color="var(--success)" style={{ margin: '0 auto' }} /> : <Activity size={16} color="var(--text-muted)" style={{ margin: '0 auto' }} />)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecutiveActionCenter({ data }) {
  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Target size={18} color="var(--accent1)" /> Executive Action Center
      </div>
      <div className="chart-sub">PRIORITIZED AI RECOMMENDATIONS</div>
      <div style={{ marginTop: '15px', overflowX: 'auto', padding: '0 10px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Priority</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Recommended Action</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Reason</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Expected Impact</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Area</th>
            </tr>
          </thead>
          <tbody>
            {data.actions.map((act, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                    background: act.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : (act.priority === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                    color: act.priority === 'High' ? '#ef4444' : (act.priority === 'Medium' ? '#f59e0b' : '#10b981')
                  }}>{act.priority}</span>
                </td>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{act.action}</td>
                <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{act.reason}</td>
                <td style={{ padding: '12px 8px', color: 'var(--accent2)' }}>{act.impact}</td>
                <td style={{ padding: '12px 8px', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{act.area}</td>
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

  if (isLoading) return <LoadingScreen message="Loading Manufacturing Intelligence..." />;
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

  const phColor = micData.plantHealth.indicator === 'Green' ? '#10b981' : (micData.plantHealth.indicator === 'Yellow' ? '#f59e0b' : '#ef4444');

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          Manufacturing <span>Intelligence</span>
          <div className="section-line" />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
          Enterprise Analytics Module
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard 
          label="Plant Health Score" 
          value={`${micData.plantHealth.score}/100`}
          sub={`Efficiency: ${micData.plantHealth.components.efficiency}% | SLA: ${micData.plantHealth.components.sla}%`}
          color1={phColor} color2={phColor}
        />
        <KPICard 
          label="Overall Efficiency" 
          value={`${micData.efficiency.efficiencyPct}%`}
          sub={micData.efficiency.gap > 0 ? `Gap: -${micData.efficiency.gap} Items` : 'On Track'}
          color1="#00c9ff" color2="#0fa8e0"
        />
        <KPICard 
          label="POs At Risk" 
          value={micData.predictions.length}
          sub="Predictive Delay Engine"
          color1="#ff3d5a" color2="#ff6b35"
        />
        <KPICard 
          label="Executive Actions" 
          value={micData.actions.length}
          sub="AI Recommendations"
          color1="#ffd60a" color2="#b24bff"
        />
      </div>

      <div className="chart-grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        <ProductionEfficiency data={micData} onDrillDown={handleDrillDown} />
        <RootCauseAnalytics data={micData} onDrillDown={handleDrillDown} />
        <InventoryIntelligence data={micData} onDrillDown={handleDrillDown} />
      </div>

      <div className="chart-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        <PredictiveDelayEngine data={micData} onDrillDown={handleDrillDown} />
        <CapacityPlanningEngine data={micData} />
        <VendorRiskIntelligence data={micData} onDrillDown={handleDrillDown} />
      </div>

      <div className="chart-grid" style={{ marginTop: '20px' }}>
        <ExecutiveActionCenter data={micData} />
      </div>

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
