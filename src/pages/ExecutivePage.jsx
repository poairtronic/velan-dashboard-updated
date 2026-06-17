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
    if (trend === 'Improving') return <TrendingUp size={16} color="var(--success)" />;
    if (trend === 'Declining') return <TrendingDown size={16} color="var(--danger)" />;
    return <Activity size={16} color="var(--text-muted)" />;
  };

  const getRiskColor = (risk) => {
    if (risk === 'CRITICAL' || risk === 'HIGH' || risk === 'High') return 'var(--danger)';
    if (risk === 'ELEVATED' || risk === 'Medium') return 'var(--warning)';
    return 'var(--success)';
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
    } else if (type === 'risk') {
      title = `High Risk Items (${value})`;
      if (value === 'Delay Risk') {
        filtered = allRows.filter(r => r.po && r.targetDate && new Date(r.targetDate) < new Date());
      } else if (value === 'Vendor SLA Risk') {
        filtered = allRows.filter(r => r.vendor && r.vendor !== 'INHOUSE'); // Simplified for demo
      } else {
        filtered = allRows;
      }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--text-muted)' }}>
              {getTrendIcon(data.kpiTrends.onTimePct.trend)}
              <span>{data.kpiTrends.onTimePct.trend}</span>
            </div>
          }
          color1="#00c9ff" color2="#0fa8e0"
        />
        <KPICard 
          label="Delayed POs" 
          value={data.kpiTrends.delayedPOs.value}
          sub={
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--text-muted)' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--text-muted)' }}>
              {getTrendIcon(data.kpiTrends.wip.trend)}
              <span>{data.kpiTrends.wip.trend}</span>
            </div>
          }
          color1="#ffd60a" color2="#b24bff"
        />
        <KPICard 
          label="Total Tracked Items" 
          value={data.rawMetrics.totalItems}
          sub={`Across ${data.rawMetrics.totalPOs} Active POs`}
          color1="#00e676" color2="#00c9ff"
        />
      </div>

      {/* 2. Operational Insights & Risks */}
      <div className="chart-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 20 }}>
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="chart-title">Management Summary</div>
          <div className="chart-sub">AI-GENERATED INSIGHTS</div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
              {data.managementSummary}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: 'auto' }}>
              <div style={{ background: 'rgba(0, 201, 255, 0.08)', border: '1px solid rgba(0, 201, 255, 0.3)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>ON-TIME DELIVERY</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent1)', fontFamily: 'Rajdhani' }}>{data.kpiTrends.onTimePct.value.toFixed(1)}%</div>
              </div>
              <div style={{ background: 'rgba(255, 61, 90, 0.08)', border: '1px solid rgba(255, 61, 90, 0.3)', padding: '15px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleDrillDown('bottleneck', data.bottleneckTrends[0]?.stage)}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>PRIMARY BOTTLENECK</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--danger)', fontFamily: 'Rajdhani' }}>{data.bottleneckTrends[0]?.stage || 'None'}</div>
              </div>
              <div style={{ background: 'rgba(255, 214, 10, 0.08)', border: '1px solid rgba(255, 214, 10, 0.3)', padding: '15px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleDrillDown('vendor', data.vendorTrends[0]?.vendor)}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>HIGHEST VENDOR RISK</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--warning)', fontFamily: 'Rajdhani' }}>{data.vendorTrends[0]?.vendor || 'None'}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="chart-title">Production Risks</div>
          <div className="chart-sub">CURRENT SYSTEM VULNERABILITIES</div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {[
              { label: 'Delay Risk', value: data.productionRisks.delayRisk },
              { label: 'Backlog Risk', value: data.productionRisks.backlogRisk },
              { label: 'Vendor SLA Risk', value: data.productionRisks.vendorRisk }
            ].map((risk, idx) => (
              <div key={idx} onClick={() => handleDrillDown('risk', risk.label)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--bg-secondary)', border: `1px solid ${getRiskColor(risk.value)}40`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = getRiskColor(risk.value)} onMouseLeave={(e) => e.currentTarget.style.borderColor = `${getRiskColor(risk.value)}40`}>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'Share Tech Mono' }}>{risk.label}</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: getRiskColor(risk.value), background: `${getRiskColor(risk.value)}20`, padding: '4px 10px', borderRadius: '4px' }}>
                  {risk.value}
                </span>
              </div>
            ))}
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
          <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 10px' }}>
            {data.bottleneckTrends.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }} onClick={() => handleDrillDown('bottleneck', b.stage)}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>{b.stage}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontFamily: 'Share Tech Mono' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Score: {b.bottleneckScore.toFixed(0)}</span>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: b.riskLevel === 'High' ? 'var(--danger)' : (b.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)'), backgroundColor: b.riskLevel === 'High' ? 'rgba(255,61,90,0.1)' : (b.riskLevel === 'Medium' ? 'rgba(255,214,10,0.1)' : 'rgba(0,230,118,0.1)') }}>
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
          <div style={{ marginTop: '15px', overflowX: 'auto', padding: '0 10px' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Vendor</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Avg Days</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Active</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorTrends.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => handleDrillDown('vendor', v.vendor)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{v.vendor}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent1)' }}>{v.avgCycleTime.toFixed(1)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{v.inProgress}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: v.slaRisk === 'High' ? 'var(--danger)' : (v.slaRisk === 'Medium' ? 'var(--warning)' : 'var(--success)'), backgroundColor: v.slaRisk === 'High' ? 'rgba(255,61,90,0.1)' : (v.slaRisk === 'Medium' ? 'rgba(255,214,10,0.1)' : 'rgba(0,230,118,0.1)') }}>
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
          <div style={{ maxHeight: '60vh', overflow: 'auto', paddingRight: '5px' }}>
            {rowsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
            ) : (
              <DataTable
                headers={['PO', 'SC', 'Product', 'Stage', 'Vendor', 'Timestamp']}
                isEmpty={!drillDown.rows || drillDown.rows.length === 0}
              >
                {drillDown.rows && drillDown.rows.slice(0, 200).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--accent1)', fontWeight: 'bold' }}>{r.po || '—'}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{r.sc || '—'}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.product}>{r.product || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.currentStage || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{r.vendor || '—'}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', fontSize: '11px', color: 'var(--text-muted)' }}>{r.timestamp ? r.timestamp.slice(0, 10) : '—'}</td>
                  </tr>
                ))}
                {drillDown.rows && drillDown.rows.length > 200 && (
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

function InfoIcon(props) {
  return <AlertCircle {...props} />;
}
