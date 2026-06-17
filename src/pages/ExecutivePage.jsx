import React, { useEffect, useState } from 'react';
import { useFilter } from '../context/FilterContext';
import KPICard from '../components/KPICard';
import { useUI } from '../context/UIContext';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Activity,
  Package,
  Clock,
  ShieldAlert
} from 'lucide-react';

export default function ExecutivePage() {
  const { filters } = useFilter();
  const { setIsLoading } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchIntelligence = async () => {
      setIsLoading(true);
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
        if (isMounted) setIsLoading(false);
      }
    };

    fetchIntelligence();
    return () => { isMounted = false; };
  }, [filters, setIsLoading]);

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

  if (!data) return null;

  const getTrendIcon = (trend) => {
    switch(trend) {
      case 'Improving': return <TrendingUp className="text-accent-teal w-5 h-5" />;
      case 'Declining': return <TrendingDown className="text-accent-red w-5 h-5" />;
      default: return <Minus className="text-gray-400 w-5 h-5" />;
    }
  };

  const getRiskColor = (risk) => {
    switch(risk) {
      case 'High':
      case 'HIGH':
      case 'CRITICAL':
        return 'text-accent-red';
      case 'Medium':
      case 'ELEVATED':
        return 'text-yellow-400';
      default:
        return 'text-accent-teal';
    }
  };

  return (
    <div className="page-container p-6 animate-fade-in" style={{ paddingBottom: '100px' }}>
      
      {/* Page Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <Activity className="w-8 h-8 text-accent-blue" />
            Executive Intelligence
          </h1>
          <p className="text-gray-400 mt-2 max-w-3xl">
            {data.managementSummary}
          </p>
        </div>
      </div>

      {/* KPI Trends Section */}
      <h2 className="text-xl font-semibold text-accent-blue mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" /> KPI Trend Analytics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-5 relative overflow-hidden">
          <div className="text-sm text-gray-400 mb-1">{data.kpiTrends.onTimePct.label}</div>
          <div className="text-3xl font-bold text-gray-100 flex items-center justify-between">
            {data.kpiTrends.onTimePct.value}%
            <div className="flex items-center gap-1 text-sm bg-gray-800 px-2 py-1 rounded">
              {getTrendIcon(data.kpiTrends.onTimePct.trend)} {data.kpiTrends.onTimePct.trend}
            </div>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="text-sm text-gray-400 mb-1">{data.kpiTrends.delayedPOs.label}</div>
          <div className="text-3xl font-bold text-gray-100 flex items-center justify-between">
            {data.kpiTrends.delayedPOs.value}
            <div className="flex items-center gap-1 text-sm bg-gray-800 px-2 py-1 rounded">
              {getTrendIcon(data.kpiTrends.delayedPOs.trend)} {data.kpiTrends.delayedPOs.trend}
            </div>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="text-sm text-gray-400 mb-1">{data.kpiTrends.wip.label}</div>
          <div className="text-3xl font-bold text-gray-100 flex items-center justify-between">
            {data.kpiTrends.wip.value}
            <div className="flex items-center gap-1 text-sm bg-gray-800 px-2 py-1 rounded">
              {getTrendIcon(data.kpiTrends.wip.trend)} {data.kpiTrends.wip.trend}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout for Bottlenecks and Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Bottleneck Intelligence */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-accent-blue mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Bottleneck Intelligence
          </h2>
          <div className="space-y-4">
            {data.bottleneckTrends.length === 0 ? (
              <p className="text-gray-400 italic">No bottlenecks detected.</p>
            ) : (
              data.bottleneckTrends.map((b, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div>
                    <div className="font-bold text-gray-200">{b.stage}</div>
                    <div className="text-xs text-gray-400">Score: {b.bottleneckScore.toFixed(1)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-semibold ${getRiskColor(b.riskLevel)}`}>{b.riskLevel} Risk</span>
                    <div className="flex items-center gap-1 text-xs">
                      {getTrendIcon(b.trend)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Vendor Intelligence */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-accent-blue mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" /> Vendor Intelligence
          </h2>
          <div className="space-y-4">
            {data.vendorTrends.length === 0 ? (
              <p className="text-gray-400 italic">No vendor data available.</p>
            ) : (
              data.vendorTrends.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div>
                    <div className="font-bold text-gray-200">{v.vendor}</div>
                    <div className="text-xs text-gray-400">Avg Cycle Time: {v.avgCycleTime.toFixed(1)} days</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-semibold ${getRiskColor(v.slaRisk)}`}>{v.slaRisk} SLA Risk</span>
                    <div className="flex items-center gap-1 text-xs">
                      {getTrendIcon(v.trend)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Production Risk Analysis */}
      <h2 className="text-xl font-semibold text-accent-blue mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" /> Production Risk Analysis
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 border-l-4" style={{ borderColor: data.productionRisks.delayRisk === 'CRITICAL' ? '#ff3d5a' : (data.productionRisks.delayRisk === 'ELEVATED' ? '#eab308' : '#00c9ff') }}>
          <div className="text-sm text-gray-400 mb-1">Schedule Delay Risk</div>
          <div className={`text-2xl font-bold ${getRiskColor(data.productionRisks.delayRisk)}`}>{data.productionRisks.delayRisk}</div>
        </div>
        <div className="card p-5 border-l-4" style={{ borderColor: data.productionRisks.backlogRisk === 'HIGH' ? '#ff3d5a' : '#00c9ff' }}>
          <div className="text-sm text-gray-400 mb-1">WIP Backlog Risk</div>
          <div className={`text-2xl font-bold ${getRiskColor(data.productionRisks.backlogRisk)}`}>{data.productionRisks.backlogRisk}</div>
        </div>
        <div className="card p-5 border-l-4" style={{ borderColor: data.productionRisks.vendorRisk === 'ELEVATED' ? '#eab308' : '#00c9ff' }}>
          <div className="text-sm text-gray-400 mb-1">Vendor Network Risk</div>
          <div className={`text-2xl font-bold ${getRiskColor(data.productionRisks.vendorRisk)}`}>{data.productionRisks.vendorRisk}</div>
        </div>
      </div>

    </div>
  );
}
