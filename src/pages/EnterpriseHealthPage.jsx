import React, { useEffect, useState, useRef } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import KPICard from '../components/KPICard';
import Timeline from '../components/common/Timeline';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
import { Shield, Database, Server, Clock, HardDrive, CheckCircle2, XCircle, Activity } from 'lucide-react';

export default function EnterpriseHealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="page-container p-6 animate-fade-in" style={{ paddingBottom: '100px' }}>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <Shield className="w-8 h-8 text-accent-teal" />
            Enterprise Health Dashboard
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time operational monitoring and system reliability metrics.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchHealth}>
          Refresh Status
        </button>
      </div>

      {/* 1. Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Memory Chart */}
        <div className="card p-6 flex flex-col h-full border border-gray-700 bg-gray-800/30">
          <h2 className="text-xl font-semibold text-accent-blue mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5" /> Memory Allocation
          </h2>
          <div className="flex-1 min-h-[200px] relative">
            <canvas ref={memoryChartRef} />
          </div>
        </div>

        {/* Queue Throughput Chart */}
        <div className="card p-6 lg:col-span-2 flex flex-col h-full border border-gray-700 bg-gray-800/30">
          <h2 className="text-xl font-semibold text-accent-teal mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" /> Queue Throughput Metrics
          </h2>
          <div className="flex-1 min-h-[200px]">
            <canvas ref={queueChartRef} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 3. Service Health Table */}
        <div className="card p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-200 mb-4 border-b border-gray-700 pb-2">Background Worker Queues</h2>
          <div className="overflow-x-auto">
            <DataTable
              headers={['Queue', 'Waiting', 'Active', 'Completed', 'Failed', 'Status']}
              isEmpty={!healthData.queueMetrics || healthData.queueMetrics.error}
            >
              {healthData.queueMetrics && !healthData.queueMetrics.error && Object.entries(healthData.queueMetrics).map(([queueName, metrics]) => (
                <tr key={queueName} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="p-3 font-mono font-bold capitalize text-accent-blue">{queueName.replace('Queue', '')}</td>
                  <td className="p-3 font-mono text-center text-yellow-400">{metrics.waiting || 0}</td>
                  <td className="p-3 font-mono text-center text-accent-teal">{metrics.active || 0}</td>
                  <td className="p-3 font-mono text-center text-gray-300">{metrics.completed || 0}</td>
                  <td className="p-3 font-mono text-center text-red-400">{metrics.failed || 0}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
                      HEALTHY
                    </span>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
          
          {healthData.pool && (
            <div className="mt-6 pt-4 border-t border-gray-700 grid grid-cols-3 gap-4">
              <div className="bg-gray-900/50 p-4 rounded-lg text-center border border-gray-800">
                <div className="text-sm text-gray-400 mb-1">PG Pool Total</div>
                <div className="text-2xl font-mono font-bold text-gray-200">{healthData.pool.totalCount}</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg text-center border border-gray-800">
                <div className="text-sm text-gray-400 mb-1">PG Pool Idle</div>
                <div className="text-2xl font-mono font-bold text-accent-teal">{healthData.pool.idleCount}</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg text-center border border-gray-800">
                <div className="text-sm text-gray-400 mb-1">PG Pool Waiting</div>
                <div className="text-2xl font-mono font-bold text-yellow-400">{healthData.pool.waitingCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Health Timeline */}
        <div className="card p-6 border border-gray-700 max-h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold text-gray-200 mb-4 sticky top-0 bg-[var(--bg-card)] z-20 pb-2 border-b border-gray-700">Sync & Event Timeline</h2>
          <Timeline events={timelineEvents} />
        </div>
      </div>
    </div>
  );
}
