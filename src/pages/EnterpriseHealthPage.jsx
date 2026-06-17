import React, { useEffect, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { Shield, Database, Server, Clock, HardDrive, CheckCircle2, XCircle } from 'lucide-react';

export default function EnterpriseHealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      const res = await fetch(`${apiBase}/api/health`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch enterprise health data');
      const json = await res.json();
      setHealthData(json);
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

  const StatusIcon = ({ status }) => {
    if (status === 'healthy' || status === 'connected' || (typeof status === 'string' && status.includes('connected'))) {
      return <CheckCircle2 className="w-5 h-5 text-accent-teal" />;
    }
    return <XCircle className="w-5 h-5 text-accent-red" />;
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card p-5 flex items-center gap-4">
          <Server className="w-10 h-10 text-accent-blue opacity-80" />
          <div>
            <div className="text-sm text-gray-400">System Status</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <StatusIcon status={healthData.status} />
              <span className="capitalize">{healthData.status}</span>
            </div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <Clock className="w-10 h-10 text-accent-teal opacity-80" />
          <div>
            <div className="text-sm text-gray-400">Uptime</div>
            <div className="text-xl font-bold text-gray-100">{healthData.uptime}</div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <Database className="w-10 h-10 text-blue-400 opacity-80" />
          <div>
            <div className="text-sm text-gray-400">Total Records</div>
            <div className="text-xl font-bold text-gray-100">{healthData.rows?.toLocaleString() || 0}</div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <HardDrive className="w-10 h-10 text-purple-400 opacity-80" />
          <div>
            <div className="text-sm text-gray-400">Memory Usage</div>
            <div className="text-xl font-bold text-gray-100">{healthData.memory?.rss || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Core Services */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-accent-blue mb-4 border-b border-gray-700 pb-2">Core Services</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3">
                <Database className="text-blue-400 w-5 h-5" />
                <span className="font-semibold text-gray-200">PostgreSQL (Neon)</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon status={healthData.database} />
              </div>
            </div>
            <div className="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3">
                <Server className="text-red-400 w-5 h-5" />
                <span className="font-semibold text-gray-200">Redis Cache</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon status={healthData.redis} />
              </div>
            </div>
            {/* Database Pool details if available */}
            {healthData.pool && (
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-700 text-sm">
                <div className="text-center">
                  <div className="text-gray-400">Pool Total</div>
                  <div className="text-gray-200">{healthData.pool.totalCount}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Pool Idle</div>
                  <div className="text-gray-200">{healthData.pool.idleCount}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Pool Waiting</div>
                  <div className="text-gray-200">{healthData.pool.waitingCount}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BullMQ Queues */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-accent-blue mb-4 border-b border-gray-700 pb-2">Background Worker Queues</h2>
          <div className="space-y-4">
            {healthData.queueMetrics && !healthData.queueMetrics.error ? (
              Object.entries(healthData.queueMetrics).map(([queueName, metrics]) => (
                <div key={queueName} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-200 capitalize">{queueName.replace('Queue', '')} Worker</span>
                    <StatusIcon status="healthy" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-center">
                    <div>
                      <div className="text-gray-400">Waiting</div>
                      <div className="text-gray-200 font-mono">{metrics.waiting || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Active</div>
                      <div className="text-gray-200 font-mono">{metrics.active || 0}</div>
                    </div>
                    <div>
                      <div className="text-accent-teal">Completed</div>
                      <div className="text-gray-200 font-mono">{metrics.completed || 0}</div>
                    </div>
                    <div>
                      <div className="text-accent-red">Failed</div>
                      <div className="text-gray-200 font-mono">{metrics.failed || 0}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-accent-red text-sm">Queue metrics unavailable</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
