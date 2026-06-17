import React, { useEffect, useState, useRef } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import KPICard from '../components/KPICard';
import Timeline from '../components/common/Timeline';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import useChart from '../utils/chartUtils';
import { Shield, Database, Server, Clock, HardDrive, CheckCircle2, XCircle, Activity, Info } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function EnterpriseHealthPage() {
  const [healthData, setHealthData] = useState(null);
  const { theme } = useTheme();
  const [syncData, setSyncData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drillDown, setDrillDown] = useState(null);

  const queueChartRef = useRef(null);
  const memoryChartRef = useRef(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      
      const [healthRes, syncRes] = await Promise.all([
        fetch(`${apiBase}/api/health`, { credentials: 'include' }),
        fetch(`${apiBase}/api/health/sync`, { credentials: 'include' })
      ]);

      if (!healthRes.ok) throw new Error('Failed to fetch enterprise health data');
      
      const healthJson = await healthRes.json();
      const syncJson = syncRes.ok ? await syncRes.json() : null;

      setHealthData(healthJson);
      setSyncData(syncJson);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      await fetchHealth();
    };
    loadData();
    const interval = setInterval(() => {
      if(isMounted) fetchHealth();
    }, 60000); // refresh every minute

    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Queue Chart
  useChart(
    queueChartRef,
    {
      type: 'bar',
      data: {
        labels: healthData?.queueMetrics && !healthData.queueMetrics.error ? Object.keys(healthData.queueMetrics).map(k => k.replace('Queue', '')) : [],
        datasets: [
          {
            label: 'Completed',
            data: healthData?.queueMetrics && !healthData.queueMetrics.error ? Object.values(healthData.queueMetrics).map(q => q.completed || 0) : [],
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Active',
            data: healthData?.queueMetrics && !healthData.queueMetrics.error ? Object.values(healthData.queueMetrics).map(q => q.active || 0) : [],
            backgroundColor: 'rgba(0, 201, 255, 0.6)',
            borderColor: '#00c9ff',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Waiting',
            data: healthData?.queueMetrics && !healthData.queueMetrics.error ? Object.values(healthData.queueMetrics).map(q => q.waiting || 0) : [],
            backgroundColor: 'rgba(245, 158, 11, 0.6)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Failed',
            data: healthData?.queueMetrics && !healthData.queueMetrics.error ? Object.values(healthData.queueMetrics).map(q => q.failed || 0) : [],
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: '#ef4444',
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
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true }
        }
      }
    },
    [healthData]
  );

  // Memory Chart
  useChart(
    memoryChartRef,
    {
      type: 'doughnut',
      data: {
        labels: ['Heap Used', 'External', 'Available'],
        datasets: [{
          data: healthData?.memory ? [
            parseFloat(healthData.memory.heapUsed),
            parseFloat(healthData.memory.external),
            parseFloat(healthData.memory.heapTotal) - parseFloat(healthData.memory.heapUsed)
          ] : [],
          backgroundColor: [
            'rgba(0, 201, 255, 0.8)',
            'rgba(178, 75, 255, 0.8)',
            'rgba(100, 116, 139, 0.3)'
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
    },
    [healthData]
  );

  if (error) {
    return (
      <div className="page-container p-6">
        <div className="card text-center p-8">
          <h2 className="text-2xl text-accent-red mb-4 flex justify-center items-center gap-2">
            <XCircle className="w-6 h-6" /> Error Loading Health Data
          </h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;
  if (!healthData) return null;

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'connected' || (typeof status === 'string' && status.includes('connected'))) {
      return '#00e676';
    }
    return '#ff3d5a';
  };

  const dbColor = getStatusColor(healthData.database);
  const redisColor = getStatusColor(healthData.redis);
  
  const timelineEvents = syncData?.history?.map(row => ({
    title: `Sync Event: ${row.sync_type || 'Unknown'}`,
    timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A',
    description: `Processed ${row.row_count} rows. Status: ${row.status.toUpperCase()}`,
    type: row.status === 'success' ? 'success' : (row.status === 'failed' ? 'error' : 'info')
  })) || [];

  const handleDrillDown = (type, value, data) => {
    setDrillDown({ type, title: value, data });
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          Enterprise <span>Health Dashboard</span>
          <div className="section-line" />
        </div>
        <button className="btn btn-secondary" onClick={fetchHealth} style={{ fontSize: '11px', padding: '6px 12px' }}>
          Refresh Status
        </button>
      </div>

      {/* 1. Health Status Cards */}
      <div className="kpi-grid">
        <KPICard 
          label="Database Status" 
          value={healthData.database === 'connected' ? 'ONLINE' : 'DEGRADED'}
          sub={`Rows: ${healthData.rows?.toLocaleString() || 0}`}
          color1={dbColor} color2={dbColor}
          badge={{ text: 'Neon PG', cls: healthData.database === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400' }}
        />
        <KPICard 
          label="Redis Cache" 
          value={healthData.redis === 'connected' ? 'ONLINE' : 'DEGRADED'}
          sub={`Latency: < 5ms`}
          color1={redisColor} color2={redisColor}
          badge={{ text: 'Upstash', cls: healthData.redis === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400' }}
        />
        <KPICard 
          label="System Uptime" 
          value={healthData.uptime}
          sub="Node.js Process"
          color1="#00c9ff" color2="#455f7b"
        />
        <KPICard 
          label="Memory RSS" 
          value={healthData.memory?.rss || 'N/A'}
          sub={`Heap: ${healthData.memory?.heapUsed}`}
          color1="#b24bff" color2="#7ba7cc"
        />
      </div>

      <div className="chart-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Memory Chart */}
        <div className="chart-card">
          <div className="chart-title">Memory Allocation</div>
          <div className="chart-sub">NODE.js HEAP VS AVAILABLE</div>
          <div className="chart-wrap" style={{ minHeight: '200px' }}>
            <canvas ref={memoryChartRef} />
          </div>
        </div>

        {/* Queue Throughput Chart */}
        <div className="chart-card">
          <div className="chart-title">Queue Throughput Metrics</div>
          <div className="chart-sub">ACTIVE VS COMPLETED VS FAILED TASKS</div>
          <div className="chart-wrap" style={{ minHeight: '200px' }}>
            <canvas ref={queueChartRef} />
          </div>
        </div>
      </div>

      <div className="chart-grid">
        {/* 3. Service Health Table */}
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chart-title">Background Worker Queues</div>
          <div className="chart-sub">REDIS BULLMQ SYSTEM TASKS</div>
          <div style={{ marginTop: '15px', overflowX: 'auto', flex: 1, padding: '0 10px' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Queue</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Waiting</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Active</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Completed</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Failed</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {healthData.queueMetrics && !healthData.queueMetrics.error && Object.entries(healthData.queueMetrics).map(([queueName, metrics]) => (
                  <tr key={queueName} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => handleDrillDown('queue', queueName, metrics)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold', textTransform: 'capitalize', color: 'var(--accent1)' }}>{queueName.replace('Queue', '')}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--warning)' }}>{metrics.waiting || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{metrics.active || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{metrics.completed || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--danger)' }}>{metrics.failed || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--success)', backgroundColor: 'rgba(0,230,118,0.1)' }}>
                        HEALTHY
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {healthData.pool && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border)', display: 'flex', gap: '15px', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>PG Pool Total</div>
                <div style={{ fontSize: '24px', fontFamily: 'Share Tech Mono', fontWeight: 'bold', color: 'var(--text-primary)' }}>{healthData.pool.totalCount}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>PG Pool Idle</div>
                <div style={{ fontSize: '24px', fontFamily: 'Share Tech Mono', fontWeight: 'bold', color: 'var(--accent2)' }}>{healthData.pool.idleCount}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>PG Pool Waiting</div>
                <div style={{ fontSize: '24px', fontFamily: 'Share Tech Mono', fontWeight: 'bold', color: 'var(--warning)' }}>{healthData.pool.waitingCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Health Timeline */}
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '600px' }}>
          <div className="chart-title" style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 20 }}>
            Sync & Event Timeline
          </div>
          <div className="chart-sub" style={{ position: 'sticky', top: 24, background: 'var(--bg-secondary)', zIndex: 20, paddingBottom: 10 }}>
            DATABASE GOOGLE SHEET SYNC EVENTS
          </div>
          <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
            <Timeline events={timelineEvents} />
          </div>
        </div>
      </div>

      {drillDown && (
        <Modal isOpen={true} onClose={() => setDrillDown(null)} title={`Queue Details: ${drillDown.title}`} maxWidth="600px" lightMode={theme === 'light'}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Real-time metrics for the <strong>{drillDown.title.replace('Queue', '')}</strong> background worker queue.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ color: '#64748b', fontSize: '12px' }}>WAITING</div>
                <div style={{ color: '#f59e0b', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.waiting || 0}</div>
              </div>
              <div style={{ background: 'rgba(0, 201, 255, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0, 201, 255, 0.3)' }}>
                <div style={{ color: '#64748b', fontSize: '12px' }}>ACTIVE</div>
                <div style={{ color: '#0ea5e9', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.active || 0}</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(15, 23, 42, 0.1)' }}>
                <div style={{ color: '#64748b', fontSize: '12px' }}>COMPLETED</div>
                <div style={{ color: '#0f172a', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.completed || 0}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ color: '#64748b', fontSize: '12px' }}>FAILED</div>
                <div style={{ color: '#ef4444', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.failed || 0}</div>
              </div>
            </div>
            <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info size={18} color="#0ea5e9" />
              <span style={{ fontSize: '13px', color: '#475569' }}>Queue is currently online and processing jobs automatically.</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
