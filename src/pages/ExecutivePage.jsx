import React, { useEffect, useState, useRef } from 'react';
import { useFilters } from '../context/FilterContext';
import KPICard from '../components/KPICard';
import LoadingScreen from '../components/LoadingScreen';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import InsightCard from '../components/common/InsightCard';
import useChart from '../utils/chartUtils';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function ExecutivePage() {
  const { filters } = useFilters();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drill Down State
  const [drillDown, setDrillDown] = useState(null);
  const { rows: allRows, isLoading: rowsLoading } = useProductionDataQuery({ ...filters, source: 'database' }, 1, 200000);

  // Chart Refs
  const bottleneckChartRef = useRef(null);
  const vendorChartRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchIntelligence = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams(filters).toString();
        const apiBase = import.meta.env.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/intelligence?${query}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch executive intelligence');
        const json = await res.json();
        if (isMounted) setData(json);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchIntelligence();
    return () => { isMounted = false; };
  }, [filters]);

  // Bottleneck Chart
  useChart(
    bottleneckChartRef,
    {
      type: 'bar',
      data: {
        labels: data?.bottleneckTrends?.map(b => b.stage) || [],
        datasets: [{
          label: 'Bottleneck Score',
          data: data?.bottleneckTrends?.map(b => b.bottleneckScore) || [],
          backgroundColor: data?.bottleneckTrends?.map(b => b.riskLevel === 'High' ? 'rgba(239, 68, 68, 0.7)' : (b.riskLevel === 'Medium' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(0, 201, 255, 0.7)')),
          borderColor: data?.bottleneckTrends?.map(b => b.riskLevel === 'High' ? '#ef4444' : (b.riskLevel === 'Medium' ? '#f59e0b' : '#00c9ff')),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Risk Score' } }
        }
      }
    },
    [data]
  );

  // Vendor Chart
  useChart(
    vendorChartRef,
    {
      type: 'bar',
      data: {
        labels: data?.vendorTrends?.map(v => v.vendor) || [],
        datasets: [{
          label: 'Avg Cycle Time (Days)',
          data: data?.vendorTrends?.map(v => v.avgCycleTime) || [],
          backgroundColor: data?.vendorTrends?.map(v => v.slaRisk === 'High' ? 'rgba(239, 68, 68, 0.7)' : (v.slaRisk === 'Medium' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(16, 185, 129, 0.7)')),
          borderColor: data?.vendorTrends?.map(v => v.slaRisk === 'High' ? '#ef4444' : (v.slaRisk === 'Medium' ? '#f59e0b' : '#10b981')),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Days Pending' } }
        }
      }
    },
    [data]
  );

  if (error) {
    return (
      <div className="page-container p-6">
        <div className="card text-center p-8">
          <h2 className="text-2xl text-accent-red mb-4">Error Loading Intelligence</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;
  if (!data) return null;

  const getTrendIcon = (trend) => {
    if (trend === 'Improving') return <TrendingUp className="w-4 h-4 text-accent-teal" />;
    if (trend === 'Declining') return <TrendingDown className="w-4 h-4 text-accent-red" />;
    return <Activity className="w-4 h-4 text-gray-400" />;
  };

  const getRiskColor = (risk) => {
    if (risk === 'CRITICAL' || risk === 'HIGH' || risk === 'High') return 'text-accent-red';
    if (risk === 'ELEVATED' || risk === 'Medium') return 'text-yellow-400';
    return 'text-accent-teal';
  };

  const handleDrillDown = (type, value) => {
    if (!allRows) return;
    let filtered = [];
    let title = '';

    if (type === 'delayed') {
      title = 'Delayed POs';
      filtered = allRows.filter(r => r.po && r.targetDate && new Date(r.targetDate) < new Date());
    } else if (type === 'bottleneck') {
      title = `Items in Stage: ${value}`;
      filtered = allRows.filter(r => r.currentStage === value);
    } else if (type === 'vendor') {
      title = `Items at Vendor: ${value}`;
      filtered = allRows.filter(r => r.vendor === value);
    }

    setDrillDown({ title, rows: filtered });
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          Executive <span>Intelligence</span>
          <div className="section-line" />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
          Last Computed: {data.timestamp}
        </div>
      </div>

      {/* 1. Executive Summary Cards */}
      <div className="kpi-grid">
        <KPICard 
          label="On-Time Delivery" 
          value={`${data.kpiTrends.onTimePct.value.toFixed(1)}%`}
          sub={
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon(data.kpiTrends.onTimePct.trend)}
              <span>{data.kpiTrends.onTimePct.trend}</span>
            </div>
          }
          color1="#00c9ff" color2="#00e676"
        />
        <KPICard 
          label="Delayed POs" 
          value={data.kpiTrends.delayedPOs.value}
          sub={
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon(data.kpiTrends.delayedPOs.trend)}
              <span>{data.kpiTrends.delayedPOs.trend}</span>
            </div>
          }
          color1="#ff3d5a" color2="#ff6b35"
          action={{ text: 'VIEW DELAYED', onClick: () => handleDrillDown('delayed') }}
        />
        <KPICard 
          label="Active WIP Count" 
          value={data.kpiTrends.wip.value}
          sub={
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon(data.kpiTrends.wip.trend)}
              <span>{data.kpiTrends.wip.trend}</span>
            </div>
          }
          color1="#b24bff" color2="#00c9ff"
        />
        <KPICard 
          label="Total Tracked Items" 
          value={data.rawMetrics.totalItems}
          sub={`Across ${data.rawMetrics.totalPOs} Active POs`}
          color1="#455f7b" color2="#7ba7cc"
        />
      </div>

      {/* 2. Operational Insights & Risks */}
      <div className="chart-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 20 }}>
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="chart-title">Management Summary</div>
          <div className="chart-sub">AI-GENERATED INSIGHTS</div>
          <div style={{ padding: '20px', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6' }}>
            {data.managementSummary}
          </div>
        </div>
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="chart-title">Production Risks</div>
          <div className="chart-sub">CURRENT SYSTEM VULNERABILITIES</div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Delay Risk</span>
              <span className={`font-bold ${getRiskColor(data.productionRisks.delayRisk)}`} style={{ fontSize: '14px' }}>{data.productionRisks.delayRisk}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Backlog Risk</span>
              <span className={`font-bold ${getRiskColor(data.productionRisks.backlogRisk)}`} style={{ fontSize: '14px' }}>{data.productionRisks.backlogRisk}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Vendor SLA Risk</span>
              <span className={`font-bold ${getRiskColor(data.productionRisks.vendorRisk)}`} style={{ fontSize: '14px' }}>{data.productionRisks.vendorRisk}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        {/* 3. Bottleneck Intelligence */}
        <div className="chart-card">
          <div className="chart-title">Top Bottlenecks</div>
          <div className="chart-sub">BY RISK SCORE</div>
          <div className="chart-wrap" style={{ minHeight: '250px' }}>
            <canvas ref={bottleneckChartRef} />
          </div>
          <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.bottleneckTrends.map((b, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-800/50 p-2 rounded border border-gray-700 cursor-pointer hover:bg-gray-800 transition" onClick={() => handleDrillDown('bottleneck', b.stage)}>
                <span className="font-semibold text-gray-200">{b.stage}</span>
                <div className="flex items-center gap-4 text-sm font-mono">
                  <span className="text-gray-400">Score: {b.bottleneckScore.toFixed(0)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${b.riskLevel === 'High' ? 'bg-red-500/20 text-red-400' : (b.riskLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400')}`}>
                    {b.riskLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Vendor Intelligence */}
        <div className="chart-card">
          <div className="chart-title">Vendor SLA Risks</div>
          <div className="chart-sub">AVERAGE CYCLE TIME PER VENDOR</div>
          <div className="chart-wrap" style={{ minHeight: '250px' }}>
            <canvas ref={vendorChartRef} />
          </div>
          <div style={{ marginTop: '15px', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Vendor</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>Avg Days</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>Active</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorTrends.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => handleDrillDown('vendor', v.vendor)} className="hover:bg-gray-800/50">
                    <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{v.vendor}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent1)' }}>{v.avgCycleTime.toFixed(1)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{v.inProgress}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${v.slaRisk === 'High' ? 'bg-red-500/20 text-red-400' : (v.slaRisk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400')}`}>
                        {v.slaRisk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      {drillDown && (
        <Modal isOpen={true} onClose={() => setDrillDown(null)} title={`Drill Down: ${drillDown.title}`} maxWidth="90%">
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <DataTable
              headers={['PO', 'SC', 'Product', 'Stage', 'Vendor', 'Timestamp']}
              isEmpty={!drillDown.rows || drillDown.rows.length === 0}
            >
              {drillDown.rows && drillDown.rows.slice(0, 100).map((r, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="p-2 font-mono text-accent-blue">{r.po || '—'}</td>
                  <td className="p-2 font-mono text-gray-300">{r.sc || '—'}</td>
                  <td className="p-2 text-gray-400 max-w-[200px] truncate" title={r.product}>{r.product || '—'}</td>
                  <td className="p-2">
                    <span className="px-2 py-1 bg-gray-800 rounded font-bold text-xs">{r.currentStage || '—'}</span>
                  </td>
                  <td className="p-2 font-mono">{r.vendor || '—'}</td>
                  <td className="p-2 font-mono text-xs text-gray-500">{r.timestamp ? r.timestamp.slice(0, 10) : '—'}</td>
                </tr>
              ))}
              {drillDown.rows && drillDown.rows.length > 100 && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-500 italic">Showing top 100 records. View Database for full list.</td>
                </tr>
              )}
            </DataTable>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoIcon(props) {
  return <AlertCircle {...props} />;
}
