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
    <div className="page-container p-6 animate-fade-in" style={{ paddingBottom: '100px' }}>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <Activity className="w-8 h-8 text-accent-blue" />
            Executive Intelligence
          </h1>
          <p className="text-gray-400 mt-2">
            AI-driven insights, trend analysis, and production risk assessment.
          </p>
        </div>
        <div className="text-sm font-mono text-gray-500">
          Last Computed: {data.timestamp}
        </div>
      </div>

      {/* 1. Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <InsightCard 
            title="Management Summary"
            content={data.managementSummary}
            icon={InfoIcon}
            type="info"
          />
        </div>
        <div className="card p-5 border border-gray-700 bg-gray-800/30">
          <h3 className="text-lg font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Production Risks</h3>
          <div className="space-y-4 font-mono text-sm">
            <div className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
              <span className="text-gray-400">Delay Risk</span>
              <span className={`font-bold ${getRiskColor(data.productionRisks.delayRisk)}`}>{data.productionRisks.delayRisk}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
              <span className="text-gray-400">Backlog Risk</span>
              <span className={`font-bold ${getRiskColor(data.productionRisks.backlogRisk)}`}>{data.productionRisks.backlogRisk}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
              <span className="text-gray-400">Vendor SLA Risk</span>
              <span className={`font-bold ${getRiskColor(data.productionRisks.vendorRisk)}`}>{data.productionRisks.vendorRisk}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 3. Bottleneck Intelligence */}
        <div className="card p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
            <h2 className="text-xl font-semibold text-accent-blue flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Top Bottlenecks
            </h2>
          </div>
          <div className="flex-1 min-h-[250px] mb-4">
            <canvas ref={bottleneckChartRef} />
          </div>
          <div className="space-y-2 mt-auto">
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
        <div className="card p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
            <h2 className="text-xl font-semibold text-accent-teal flex items-center gap-2">
              <Activity className="w-5 h-5" /> Vendor SLA Risks
            </h2>
          </div>
          <div className="flex-1 min-h-[250px] mb-4">
            <canvas ref={vendorChartRef} />
          </div>
          <div className="overflow-x-auto mt-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 font-mono">
                  <th className="p-2 text-left">Vendor</th>
                  <th className="p-2 text-center">Avg Days</th>
                  <th className="p-2 text-center">Active</th>
                  <th className="p-2 text-center">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorTrends.map((v, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition" onClick={() => handleDrillDown('vendor', v.vendor)}>
                    <td className="p-2 font-bold text-gray-200">{v.vendor}</td>
                    <td className="p-2 text-center font-mono">{v.avgCycleTime.toFixed(1)}</td>
                    <td className="p-2 text-center font-mono">{v.inProgress}</td>
                    <td className="p-2 text-center">
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
