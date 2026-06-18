import React, { useState, useEffect } from 'react';
import { apiBase, apiClient } from '../services/apiClient';
import { toast } from 'react-hot-toast';

export default function ProductionReadinessDashboard() {
  const [health, setHealth] = useState(null);
  const [perf, setPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // DR States
  const [drRunning, setDrRunning] = useState({ gracefulDegradationTest: false, fallbackTest: false });
  const [drResults, setDrResults] = useState({
    gracefulDegradationTest: null,
    fallbackTest: null
  });

  const fetchHealthAndPerf = async () => {
    try {
      const [healthRes, perfRes] = await Promise.all([
        apiClient(`${apiBase}/api/health/full`),
        apiClient(`${apiBase}/api/perf/report`)
      ]);
      const healthData = await healthRes.json();
      const perfData = await perfRes.json();
      
      setHealth(healthData);
      if (perfData.success) {
        setPerf(perfData.report || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthAndPerf();
    // Poll health status every 10 seconds
    const interval = setInterval(fetchHealthAndPerf, 10000);
    return () => clearInterval(interval);
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

  if (loading && !health) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid rgba(0, 201, 255, 0.2)',
            borderTop: '2px solid var(--accent1)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px auto'
          }}
        />
        Gathering enterprise systems diagnostics...
      </div>
    );
  }

  const getStatusDot = (status) => {
    const color = status === 'healthy' ? 'var(--success, #00e676)' : (status === 'degraded' ? 'var(--warning, #ffd60a)' : 'var(--danger, #ff3d5a)');
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
    if (status === 'healthy') return 'var(--success, #00e676)';
    if (status === 'degraded') return 'var(--warning, #ffd60a)';
    return 'var(--danger, #ff3d5a)';
  };

  return (
    <div style={{ fontFamily: 'Exo 2, sans-serif' }}>
      <div className="section-title">
        Production Readiness <span>Command Center</span>
        <div className="section-line" />
      </div>

      {/* Aggregate Health Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
        
        {/* API Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>API GATEWAY</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(health?.api?.status) }}>
              {getStatusDot(health?.api?.status)} {health?.api?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Latency Response: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{health?.api?.responseTimeMs}ms</span></div>
            <div style={{ marginTop: 6 }}>Endpoints protection: <span style={{ color: 'var(--success)' }}>Active (JWT Session + Rate Limiter)</span></div>
          </div>
        </div>

        {/* Database Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>NEON POSTGRESQL</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(health?.database?.status) }}>
              {getStatusDot(health?.database?.status)} {health?.database?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Ping Latency: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{health?.database?.avgQueryTimeMs}ms</span></div>
            <div style={{ marginTop: 6 }}>Pool Connections: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent2)' }}>{health?.database?.connectionCount} active</span></div>
          </div>
        </div>

        {/* Redis Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>UPSTASH REDIS</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(health?.redis?.status) }}>
              {getStatusDot(health?.redis?.status)} {health?.redis?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Hit Ratio: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{health?.redis?.hitRatio}%</span></div>
            <div style={{ marginTop: 6 }}>Cache Used: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent2)' }}>{health?.redis?.memoryUsedMB} MB</span></div>
          </div>
        </div>

        {/* WebSocket Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>WEBSOCKET LIVE STREAM</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(health?.websocket?.status) }}>
              {getStatusDot(health?.websocket?.status)} {health?.websocket?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Connections: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{health?.websocket?.activeConnections} online</span></div>
            <div style={{ marginTop: 6 }}>Broadcast latency: <span style={{ color: 'var(--success)' }}>&lt; 5ms</span></div>
          </div>
        </div>

        {/* Background Jobs Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>BULLMQ / REDIS QUEUES</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(health?.backgroundJobs?.status) }}>
              {getStatusDot(health?.backgroundJobs?.status)} {health?.backgroundJobs?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Last Sync job: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{health?.backgroundJobs?.lastRunAt ? new Date(health?.backgroundJobs?.lastRunAt).toLocaleTimeString() : 'never'}</span></div>
            <div style={{ marginTop: 6 }}>Total Failed: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--danger)' }}>{health?.backgroundJobs?.failedCount} failed</span></div>
          </div>
        </div>

        {/* Google Sheets Sync Card */}
        <div className="table-card" style={{ padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>GOOGLE SHEET SYNC</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: getStatusColor(health?.googleSheetSync?.status) }}>
              {getStatusDot(health?.googleSheetSync?.status)} {health?.googleSheetSync?.status?.toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Last sync entries: <span style={{ fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{health?.googleSheetSync?.lastSyncRowCount} rows</span></div>
            <div style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Latest Msg: <span style={{ color: health?.googleSheetSync?.errorMessage ? 'var(--danger)' : 'var(--text-muted)' }}>{health?.googleSheetSync?.errorMessage || 'Success'}</span>
            </div>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start', marginBottom: 20 }}>
        
        {/* DR Panel */}
        <div className="table-card" style={{ border: '1px solid var(--border)', height: '100%' }}>
          <div className="table-header">
            <div className="chart-title">Disaster Recovery (DR) Validation</div>
            <div className="chart-sub">Trigger simulation outages and verify graceful degradations</div>
          </div>
          <div style={{ padding: 16 }}>
            
            {/* Outage 1 */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent1)' }}>Graceful Degradation simulation</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                    Temporarily toggle Redis Cache unavailable. Verify command calculations gracefully fall back to database queries without crashing the user's browser.
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
                  <div style={{ fontWeight: 600, color: drResults.gracefulDegradationTest.passed ? 'var(--success)' : 'var(--danger)' }}>
                    {drResults.gracefulDegradationTest.passed ? '✓ PASSED' : '✗ FAILED'} · {new Date(drResults.gracefulDegradationTest.testedAt).toLocaleTimeString()}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{drResults.gracefulDegradationTest.details}</div>
                </div>
              )}
            </div>

            {/* Outage 2 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent1)' }}>Sync Outage Fallback simulation</div>
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
                  <div style={{ fontWeight: 600, color: drResults.fallbackTest.passed ? 'var(--success)' : 'var(--danger)' }}>
                    {drResults.fallbackTest.passed ? '✓ PASSED' : '✗ FAILED'} · {new Date(drResults.fallbackTest.testedAt).toLocaleTimeString()}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{drResults.fallbackTest.details}</div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Perf Benchmarks Panel */}
        <div className="table-card" style={{ border: '1px solid var(--border)', height: '100%' }}>
          <div className="table-header">
            <div className="chart-title">Route Performance & Latency Benchmarks</div>
            <div className="chart-sub">Real-time p50/p95/p99 query latencies and caching ratios</div>
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(26,58,92,0.15)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>ENDPOINT</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>SAMPLES</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>p50 (MEDIAN)</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>p95 (TAIL)</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>p99 (PEAK)</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>CACHE HIT</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(26,58,92,0.1)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{item.endpoint}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{item.count}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace' }}>{item.p50}ms</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace', color: item.p95 > 250 ? 'var(--warning)' : 'inherit' }}>{item.p95}ms</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'Share Tech Mono, monospace', color: item.p99 > 500 ? 'var(--danger)' : 'inherit' }}>{item.p99}ms</td>
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

      </div>
    </div>
  );
}
