import React, { useEffect, useState, useRef } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import Timeline from '../components/common/Timeline';
import Modal from '../components/Modal';
import useChart from '../utils/chartUtils';
import { 
  Shield, Database, Server, Clock, HardDrive, 
  CheckCircle2, XCircle, Activity, Info, Zap, Cpu, RefreshCw, Terminal
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiBase, apiClient } from '../services/apiClient';
import { toast } from 'react-hot-toast';

export default function EnterpriseHealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [fullHealthData, setFullHealthData] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drillDown, setDrillDown] = useState(null);
  
  // DR States
  const [drRunning, setDrRunning] = useState({ gracefulDegradationTest: false, fallbackTest: false });
  const [drResults, setDrResults] = useState({
    gracefulDegradationTest: null,
    fallbackTest: null
  });

  const { theme } = useTheme();
  const memoryChartRef = useRef(null);

  const fetchAllDiagnostics = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [healthRes, fullRes, syncRes, perfRes] = await Promise.all([
        apiClient(`${apiBase}/api/health`),
        apiClient(`${apiBase}/api/health/full`),
        apiClient(`${apiBase}/api/sync-status`),
        apiClient(`${apiBase}/api/perf/report`)
      ]);

      const healthJson = await healthRes.json();
      const fullJson = await fullRes.json();
      const syncJson = await syncRes.json();
      const perfJson = await perfRes.json();

      setHealthData(healthJson);
      setFullHealthData(fullJson);
      setSyncData(syncJson);
      if (perfJson.success) {
        setPerfData(perfJson.report || []);
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to gather diagnostic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      await fetchAllDiagnostics(true);
    };
    loadData();

    const interval = setInterval(() => {
      if (isMounted) fetchAllDiagnostics(false);
    }, 10000); // refresh status every 10 seconds

    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const runDRTest = async (scenario) => {
    try {
      setDrRunning(prev => ({ ...prev, [scenario]: true }));
      const res = await apiClient(`${apiBase}/api/health/dr/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();
      setDrResults(prev => ({ ...prev, [scenario]: data }));
      
      if (data.passed) {
        toast.success(`DR Test Passed: ${scenario}`);
      } else {
        toast.error(`DR Test Failed: ${scenario}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Disaster recovery validation failed to execute');
    } finally {
      setDrRunning(prev => ({ ...prev, [scenario]: false }));
    }
  };

  // Node.js Memory Allocation Chart
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
          ] : [0, 0, 100],
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
          legend: { 
            position: 'right',
            labels: {
              color: 'var(--text-primary)',
              font: { family: 'Share Tech Mono', size: 11 }
            }
          }
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
          <button className="btn btn-primary mt-4" onClick={() => fetchAllDiagnostics(true)}>
            Retry Diagnostic Check
          </button>
        </div>
      </div>
    );
  }

  if (loading && !healthData) return <LoadingScreen message="Gathering enterprise system diagnostics..." />;

  const getStatusDot = (status) => {
    const isHealthy = status === 'healthy' || status === 'connected' || (typeof status === 'string' && status.includes('connected'));
    const color = isHealthy ? 'var(--success, #00e676)' : (status === 'degraded' ? 'var(--warning, #ffd60a)' : 'var(--danger, #ff3d5a)');
    return (
      <span 
        style={{ 
          display: 'inline-block', 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}`,
          marginRight: '8px'
        }} 
      />
    );
  };

  const getStatusColor = (status) => {
    const isHealthy = status === 'healthy' || status === 'connected' || (typeof status === 'string' && status.includes('connected'));
    if (isHealthy) return 'var(--success, #00e676)';
    if (status === 'degraded') return 'var(--warning, #ffd60a)';
    return 'var(--danger, #ff3d5a)';
  };

  const timelineEvents = syncData?.logs?.map(row => ({
    title: `Sync Event: ${row.sync_type || 'Unknown'}`,
    timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A',
    description: `Processed ${row.row_count} rows (Updated: ${row.rows_updated}, Skipped: ${row.rows_skipped}). Status: ${row.status.toUpperCase()}`,
    type: row.status === 'success' ? 'success' : (row.status === 'failed' || row.status === 'error' ? 'error' : 'info')
  })) || [];

  const handleDrillDown = (type, value, metrics) => {
    setDrillDown({ type, title: value, data: metrics });
  };

  return (
    <div style={{ paddingBottom: '100px', fontFamily: 'Exo 2, sans-serif' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          Enterprise <span>Health Dashboard</span>
          <div className="section-line" />
        </div>
        <button className="btn btn-secondary" onClick={() => fetchAllDiagnostics(true)} style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={12} /> Refresh Status
        </button>
      </div>

      {/* --- 1. Systems Diagnostic Grid --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
        
        {/* API Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} color="var(--accent1)" /> API GATEWAY
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(fullHealthData?.api?.status), fontFamily: 'Share Tech Mono' }}>
              {getStatusDot(fullHealthData?.api?.status)} {fullHealthData?.api?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Latency Response: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{fullHealthData?.api?.responseTimeMs}ms</span></div>
            <div style={{ marginTop: 6 }}>Endpoints security: <span style={{ color: 'var(--success)' }}>Active (JWT Sessions)</span></div>
          </div>
        </div>

        {/* Database Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={16} color="var(--accent2)" /> NEON POSTGRESQL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(fullHealthData?.database?.status), fontFamily: 'Share Tech Mono' }}>
              {getStatusDot(fullHealthData?.database?.status)} {fullHealthData?.database?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Avg Query Ping: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{fullHealthData?.database?.avgQueryTimeMs}ms</span></div>
            <div style={{ marginTop: 6 }}>Active Connections: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent2)' }}>{fullHealthData?.database?.connectionCount} pool</span></div>
          </div>
        </div>

        {/* Redis Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HardDrive size={16} color="#b24bff" /> UPSTASH REDIS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(fullHealthData?.redis?.status), fontFamily: 'Share Tech Mono' }}>
              {getStatusDot(fullHealthData?.redis?.status)} {fullHealthData?.redis?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Hit Ratio: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{fullHealthData?.redis?.hitRatio}%</span></div>
            <div style={{ marginTop: 6 }}>Memory Allocated: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent2)' }}>{fullHealthData?.redis?.memoryUsedMB} MB</span></div>
          </div>
        </div>

        {/* WebSocket Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={16} color="var(--success)" /> WEBSOCKET STREAM
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(fullHealthData?.websocket?.status), fontFamily: 'Share Tech Mono' }}>
              {getStatusDot(fullHealthData?.websocket?.status)} {fullHealthData?.websocket?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Active Streams: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{fullHealthData?.websocket?.activeConnections} users</span></div>
            <div style={{ marginTop: 6 }}>Broadcast Latency: <span style={{ color: 'var(--success)' }}>&lt; 5ms</span></div>
          </div>
        </div>

        {/* Background Jobs Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={16} color="var(--warning)" /> BULLMQ WORKERS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(fullHealthData?.backgroundJobs?.status), fontFamily: 'Share Tech Mono' }}>
              {getStatusDot(fullHealthData?.backgroundJobs?.status)} {fullHealthData?.backgroundJobs?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Last Sync: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{fullHealthData?.backgroundJobs?.lastRunAt ? new Date(fullHealthData.backgroundJobs.lastRunAt).toLocaleTimeString() : 'never'}</span></div>
            <div style={{ marginTop: 6 }}>Failed Tasks: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--danger)' }}>{fullHealthData?.backgroundJobs?.failedCount || 0} failed</span></div>
          </div>
        </div>

        {/* Google Sheets Sync Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={16} color="var(--accent1)" /> GOOGLE SHEETS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(fullHealthData?.googleSheetSync?.status), fontFamily: 'Share Tech Mono' }}>
              {getStatusDot(fullHealthData?.googleSheetSync?.status)} {fullHealthData?.googleSheetSync?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Import Size: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{fullHealthData?.googleSheetSync?.lastSyncRowCount} rows</span></div>
            <div style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Message: <span style={{ color: fullHealthData?.googleSheetSync?.errorMessage ? 'var(--danger)' : 'var(--text-muted)' }}>{fullHealthData?.googleSheetSync?.errorMessage || 'Sync Success'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* --- 2. Background Worker Queues Table & Memory Doughnut --- */}
      <div className="chart-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 20 }}>
        
        {/* Background Workers */}
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chart-title">Background Worker Queues</div>
          <div className="chart-sub">REDIS BULLMQ SYSTEM TASK SCHEDULES</div>
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
                {healthData?.queueMetrics && !healthData.queueMetrics.error && Object.entries(healthData.queueMetrics).map(([queueName, metrics]) => (
                  <tr key={queueName} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => handleDrillDown('queue', queueName, metrics)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold', textTransform: 'capitalize', color: 'var(--accent1)' }}>{queueName.replace('Queue', '')}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--warning)' }}>{metrics.waiting || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--accent2)' }}>{metrics.active || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--text-primary)' }}>{metrics.completed || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'Share Tech Mono', color: 'var(--danger)' }}>{metrics.failed || 0}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--success)', backgroundColor: 'rgba(0,230,118,0.1)' }}>
                        ONLINE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {healthData?.pool && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border)', display: 'flex', gap: '15px', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>PG Pool Total</div>
                <div style={{ fontSize: '20px', fontFamily: 'Share Tech Mono', fontWeight: 'bold', color: 'var(--text-primary)' }}>{healthData.pool.totalCount}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>PG Pool Idle</div>
                <div style={{ fontSize: '20px', fontFamily: 'Share Tech Mono', fontWeight: 'bold', color: 'var(--accent2)' }}>{healthData.pool.idleCount}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>PG Pool Waiting</div>
                <div style={{ fontSize: '20px', fontFamily: 'Share Tech Mono', fontWeight: 'bold', color: 'var(--warning)' }}>{healthData.pool.waitingCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* Memory Doughnut & Uptime metrics */}
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chart-title">Memory Allocation</div>
          <div className="chart-sub">NODE.js PROCESS HEALTH STATISTICS</div>
          <div className="chart-wrap" style={{ minHeight: '160px', position: 'relative' }}>
            <canvas ref={memoryChartRef} />
          </div>
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>SYSTEM UPTIME</span>
              <span style={{ fontWeight: 'bold', fontFamily: 'Share Tech Mono', color: 'var(--accent1)' }}>{healthData?.uptime || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>PROCESS RSS SIZE</span>
              <span style={{ fontWeight: 'bold', fontFamily: 'Share Tech Mono', color: '#b24bff' }}>{healthData?.memory?.rss || 'N/A'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* --- 3. Route Performance & Disaster Recovery --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 14, marginBottom: 20 }}>
        
        {/* Route Performance */}
        <div className="table-card" style={{ border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div className="table-header" style={{ padding: '16px 16px 8px 16px' }}>
            <div className="chart-title">Route Performance & Latencies</div>
            <div className="chart-sub">Real-time endpoint median vs peak (tail) times</div>
          </div>
          <div style={{ padding: '0 16px 16px 16px', overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(26,58,92,0.15)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>ENDPOINT</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>SAMPLES</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>p50 (MED)</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>p95 (TAIL)</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>CACHE HIT</th>
                </tr>
              </thead>
              <tbody>
                {perfData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(26,58,92,0.1)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{item.endpoint}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{item.count}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace' }}>{item.p50}ms</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace', color: item.p95 > 250 ? 'var(--warning)' : 'inherit' }}>{item.p95}ms</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 40, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${item.cacheHitRatio}%`, height: '100%', background: 'var(--success)' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.cacheHitRatio}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disaster Recovery simulator */}
        <div className="table-card" style={{ border: '1px solid var(--border)' }}>
          <div className="table-header" style={{ padding: '16px 16px 8px 16px' }}>
            <div className="chart-title">Disaster Recovery (DR) Simulation</div>
            <div className="chart-sub">Outage simulations validating database and sheet sync grace fallback</div>
          </div>
          <div style={{ padding: 16 }}>
            
            {/* Outage 1 */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} /> Graceful Degradation simulation
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                    Temporarily toggle Redis Cache offline. Verify command calculations gracefully fall back to database queries without crashing the user's browser.
                  </div>
                </div>
                <button
                  onClick={() => runDRTest('gracefulDegradationTest')}
                  disabled={drRunning.gracefulDegradationTest}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(255, 61, 90, 0.1)',
                    border: '1px solid var(--danger)',
                    borderRadius: 6,
                    color: 'var(--danger)',
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: drRunning.gracefulDegradationTest ? 0.7 : 1
                  }}
                >
                  {drRunning.gracefulDegradationTest ? 'TESTING...' : 'RUN DR TEST'}
                </button>
              </div>
              
              {drResults.gracefulDegradationTest && (
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${drResults.gracefulDegradationTest.passed ? 'var(--success)22' : 'var(--danger)22'}`,
                  borderRadius: 6,
                  padding: 10,
                  marginTop: 10,
                  fontSize: '11px'
                }}>
                  <div style={{ fontWeight: 600, color: drResults.gracefulDegradationTest.passed ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {drResults.gracefulDegradationTest.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {drResults.gracefulDegradationTest.passed ? '✓ PASSED' : '✗ FAILED'} · {new Date(drResults.gracefulDegradationTest.testedAt).toLocaleTimeString()}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'Share Tech Mono' }}>{drResults.gracefulDegradationTest.details}</div>
                </div>
              )}
            </div>

            {/* Outage 2 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Terminal size={14} /> Sync Outage Fallback simulation
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                    Simulate Google sheets sync failure. Verify sync failure logs are written and the dashboard continues loading existing data from the database state safely.
                  </div>
                </div>
                <button
                  onClick={() => runDRTest('fallbackTest')}
                  disabled={drRunning.fallbackTest}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(255, 61, 90, 0.1)',
                    border: '1px solid var(--danger)',
                    borderRadius: 6,
                    color: 'var(--danger)',
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: drRunning.fallbackTest ? 0.7 : 1
                  }}
                >
                  {drRunning.fallbackTest ? 'TESTING...' : 'RUN DR TEST'}
                </button>
              </div>
              
              {drResults.fallbackTest && (
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${drResults.fallbackTest.passed ? 'var(--success)22' : 'var(--danger)22'}`,
                  borderRadius: 6,
                  padding: 10,
                  marginTop: 10,
                  fontSize: '11px'
                }}>
                  <div style={{ fontWeight: 600, color: drResults.fallbackTest.passed ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {drResults.fallbackTest.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {drResults.fallbackTest.passed ? '✓ PASSED' : '✗ FAILED'} · {new Date(drResults.fallbackTest.testedAt).toLocaleTimeString()}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'Share Tech Mono' }}>{drResults.fallbackTest.details}</div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* --- 4. Sync logs timeline --- */}
      <div className="chart-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
          <div className="chart-title" style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 20 }}>
            Sync & Event Timeline
          </div>
          <div className="chart-sub" style={{ position: 'sticky', top: 24, background: 'var(--bg-secondary)', zIndex: 20, paddingBottom: 10 }}>
            DATABASE GOOGLE SHEET SYNC EVENTS HISTORY
          </div>
          <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
            {timelineEvents.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No recent Google Sheets sync logs available.
              </div>
            ) : (
              <Timeline events={timelineEvents} />
            )}
          </div>
        </div>
      </div>

      {/* Queue Drilldown Modal */}
      {drillDown && (
        <Modal isOpen={true} onClose={() => setDrillDown(null)} title={`Queue Details: ${drillDown.title}`} maxWidth="600px" lightMode={theme === 'light'}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Real-time metrics for the <strong>{drillDown.title.replace('Queue', '')}</strong> background worker queue.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>WAITING</div>
                <div style={{ color: '#f59e0b', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.waiting || 0}</div>
              </div>
              <div style={{ background: 'rgba(0, 201, 255, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0, 201, 255, 0.3)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>ACTIVE</div>
                <div style={{ color: '#0ea5e9', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.active || 0}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>COMPLETED</div>
                <div style={{ color: '#10b981', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.completed || 0}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>FAILED</div>
                <div style={{ color: '#ef4444', fontSize: '28px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>{drillDown.data.failed || 0}</div>
              </div>
            </div>
            <div style={{ marginTop: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info size={18} color="var(--accent1)" />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Queue is currently online and processing jobs automatically.</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
