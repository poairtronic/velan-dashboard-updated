import React, { useState, useRef } from 'react';
import { useFilters } from '../context/FilterContext';
import { useTheme } from '../context/ThemeContext';
import useMicDataQuery from '../hooks/useMicDataQuery';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import useChart from '../utils/chartUtils';
import LoadingScreen from '../components/LoadingScreen';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import InsightCard from '../components/common/InsightCard';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Box, 
  Target,
  Zap,
  CheckCircle2,
  ListRestart,
  AlertCircle
} from 'lucide-react';
import { workingDaysBetween } from '../utils/calculationUtils';

// --- Modules ---
function PlantHealthScore({ data }) {
  const { plantHealth } = data;
  return (
    <div className="module-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '5px' }}>Plant Health Score</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Real-time overall health</p>
        </div>
        <div style={{
          width: '15px', height: '15px', borderRadius: '50%',
          background: plantHealth.indicator === 'Green' ? '#10b981' : (plantHealth.indicator === 'Yellow' ? '#f59e0b' : '#ef4444'),
          boxShadow: `0 0 10px ${plantHealth.indicator === 'Green' ? '#10b981' : (plantHealth.indicator === 'Yellow' ? '#f59e0b' : '#ef4444')}`
        }} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <div style={{ fontSize: '64px', fontWeight: 'bold', fontFamily: 'Rajdhani', lineHeight: 1, color: 'var(--text-primary)' }}>
          {plantHealth.score}
        </div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>/ 100</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '10px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>EFFICIENCY</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{plantHealth.components.efficiency}%</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SLA PERF</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{plantHealth.components.sla}%</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>VENDOR</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{plantHealth.components.vendor}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>FLOW</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{plantHealth.components.bottleneck}</div>
        </div>
      </div>
    </div>
  );
}

function ProductionEfficiency({ data, onDrillDown }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'bar',
    data: {
      labels: ['Planned vs Actual'],
      datasets: [
        {
          label: 'Planned Output',
          data: [data.efficiency.planned],
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: '#3b82f6',
          borderWidth: 1
        },
        {
          label: 'Actual Output',
          data: [data.efficiency.actual],
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10b981',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  }, [data]);

  return (
    <div className="module-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '0' }}>Efficiency Intelligence</h2>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, height: '180px' }}>
          <canvas ref={chartRef}></canvas>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>GAP ANALYSIS</div>
            <div style={{ color: 'var(--danger)', fontSize: '24px', fontWeight: 'bold' }}>
              {data.efficiency.gap > 0 ? `-${data.efficiency.gap} items` : 'On Track'}
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>EFFICIENCY</div>
            <div style={{ color: 'var(--accent1)', fontSize: '24px', fontWeight: 'bold' }}>
              {data.efficiency.efficiencyPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RootCauseAnalytics({ data, onDrillDown }) {
  const chartRef = useRef(null);
  useChart(chartRef, {
    type: 'doughnut',
    data: {
      labels: data.rootCause.map(r => r.cause),
      datasets: [{
        data: data.rootCause.map(r => r.contribution),
        backgroundColor: [
          '#ef4444', // red
          '#f59e0b', // yellow
          '#10b981', // green
          '#3b82f6', // blue
        ],
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
    <div className="module-card">
      <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Root Cause Analytics</h2>
      <div style={{ height: '220px', position: 'relative' }}>
        <canvas ref={chartRef}></canvas>
        <div style={{ position: 'absolute', top: '50%', left: '33%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Delays</div>
           <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
             {data.rootCause.reduce((a, b) => a + b.count, 0)}
           </div>
        </div>
      </div>
    </div>
  );
}

function PredictiveDelayEngine({ data, onDrillDown }) {
  return (
    <div className="module-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Predictive Delay Engine</h2>
        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
          {data.predictions.length} POs At Risk
        </span>
      </div>
      <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
        <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>PO</th>
              <th>Current Age</th>
              <th>Expected Delay</th>
              <th>Forecasted Completion</th>
            </tr>
          </thead>
          <tbody>
            {data.predictions.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No predictions to display.</td></tr>
            ) : (
              data.predictions.map((p, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onDrillDown('PO', p.po)}>
                  <td style={{ color: 'var(--accent1)' }}>{p.po}</td>
                  <td>{p.currentAge} days</td>
                  <td style={{ color: 'var(--danger)' }}>+{p.expectedDelay} days</td>
                  <td>{p.expectedCompletion}</td>
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
    <div className="module-card">
      <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Capacity Planning Engine</h2>
      <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
        <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Queue</th>
              <th>Est. Capacity</th>
              <th>Utilization</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.capacity.slice(0, 10).map((c, i) => (
              <tr key={i}>
                <td>{c.stage}</td>
                <td>{c.queue}</td>
                <td>{c.capacity}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '50px', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, c.utilization)}%`, background: c.utilization > 80 ? '#ef4444' : (c.utilization > 50 ? '#f59e0b' : '#10b981') }} />
                    </div>
                    <span>{c.utilization}%</span>
                  </div>
                </td>
                <td>
                  <span style={{ 
                    padding: '2px 6px', borderRadius: '4px', fontSize: '12px',
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
    <div className="module-card">
      <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Vendor Risk Intelligence</h2>
      <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
        <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Items</th>
              <th>Avg Days</th>
              <th>Delay Prob.</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.vendorRisk.map((v, i) => (
              <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onDrillDown('Vendor', v.vendor)}>
                <td style={{ color: 'var(--accent1)' }}>{v.vendor}</td>
                <td>{v.count}</td>
                <td>{v.avgDays}</td>
                <td>
                  <span style={{ color: v.delayProbability > 50 ? '#ef4444' : 'inherit' }}>{v.delayProbability}%</span>
                </td>
                <td>
                  {v.trend === 'Declining' ? <TrendingDown size={16} color="#ef4444" /> : 
                  (v.trend === 'Improving' ? <TrendingUp size={16} color="#10b981" /> : <Activity size={16} color="var(--text-muted)" />)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryIntelligence({ data, onDrillDown }) {
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
        borderWidth: 0
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
    <div className="module-card">
      <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Inventory Intelligence</h2>
      <div style={{ height: '220px' }}>
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
}

function ExecutiveActionCenter({ data }) {
  return (
    <div className="module-card" style={{ gridColumn: '1 / -1' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Target size={20} color="var(--accent1)" /> Executive Action Center
      </h2>
      <div className="table-wrap">
        <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Priority</th>
              <th>Recommended Action</th>
              <th>Reason</th>
              <th>Expected Impact</th>
              <th>Area</th>
            </tr>
          </thead>
          <tbody>
            {data.actions.map((act, i) => (
              <tr key={i}>
                <td>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                    background: act.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : (act.priority === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                    color: act.priority === 'High' ? '#ef4444' : (act.priority === 'Medium' ? '#f59e0b' : '#10b981')
                  }}>{act.priority}</span>
                </td>
                <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{act.action}</td>
                <td style={{ color: 'var(--text-muted)' }}>{act.reason}</td>
                <td>{act.impact}</td>
                <td>{act.area}</td>
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
  if (error) return <div style={{ padding: '40px', color: '#ef4444' }}>Error: {error.message}</div>;
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
    <div className="page-container" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={24} color="var(--accent1)" />
          Manufacturing Intelligence Center
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
          Enterprise analytics for predictive operations, risk assessment, and capacity planning.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <PlantHealthScore data={micData} />
        <ProductionEfficiency data={micData} onDrillDown={handleDrillDown} />
        <RootCauseAnalytics data={micData} onDrillDown={handleDrillDown} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <PredictiveDelayEngine data={micData} onDrillDown={handleDrillDown} />
        <CapacityPlanningEngine data={micData} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <VendorRiskIntelligence data={micData} onDrillDown={handleDrillDown} />
        <InventoryIntelligence data={micData} onDrillDown={handleDrillDown} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
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
                    <td style={{ color: 'var(--accent1)', fontWeight: 'bold' }}>{r.po}</td>
                    <td>{r.sc}</td>
                    <td>{r.product}</td>
                    <td>
                      <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                        {r.currentStage}
                      </span>
                    </td>
                    <td>{r.inhouse === 'VENDOR' ? 'Yes' : 'No'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.timestamp}</td>
                  </tr>
                ))}
              </DataTable>
            )}
            {drillDown.data && drillDown.data.length > 200 && (
              <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Showing first 200 records. Export for full dataset.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
