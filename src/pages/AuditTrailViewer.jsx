import React, { useState, useEffect } from 'react';
import { apiBase, apiClient } from '../services/apiClient';
import { toast } from 'react-hot-toast';

export default function AuditTrailViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userFilter) params.append('user', userFilter);
      if (actionFilter) params.append('action', actionFilter);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const res = await apiClient(`${apiBase}/api/audit/history?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        toast.error('Failed to load audit history');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [actionFilter, fromDate, toDate]); // Auto-refresh on select/date changes

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  const exportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }

    const headers = ['ID', 'Timestamp', 'Action', 'User Email', 'IP Address', 'Entity Type', 'Entity ID', 'Metadata'];
    const rows = logs.map(log => [
      log.id,
      new Date(log.timestamp).toISOString(),
      log.action,
      log.user_email || 'anonymous',
      log.ip_address || '—',
      log.entity_type || '—',
      log.entity_id || '—',
      log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `velan_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit trail exported successfully.');
  };

  const actionTypes = [
    'USER_LOGIN', 'USER_LOGOUT', 'DATA_UPLOAD', 'SYNC_TRIGGER',
    'EXPORT', 'ALERT_ACKNOWLEDGED', 'CONFIG_CHANGE', 'FRONTEND_ERROR'
  ];

  return (
    <div style={{ fontFamily: 'Exo 2, sans-serif' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          Audit Trail <span>Explorer</span>
          <div className="section-line" />
        </div>
        <button
          onClick={exportCSV}
          style={{
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent1)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          📥 EXPORT TO CSV
        </button>
      </div>

      {/* Filter Control Bar */}
      <form onSubmit={handleSearchSubmit} className="table-card" style={{ padding: '16px 18px', marginBottom: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>
              SEARCH USER EMAIL / ID
            </label>
            <input
              type="text"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="e.g. admin@velanmetrology.com"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ width: 180 }}>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>
              FILTER BY ACTION TYPE
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(5, 11, 20, 0.95)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            >
              <option value="">ALL ACTIONS</option>
              {actionTypes.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 140 }}>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>
              FROM DATE
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ width: 140 }}>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>
              TO DATE
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '9px 18px',
              background: 'rgba(0, 201, 255, 0.1)',
              border: '1px solid var(--accent1)',
              borderRadius: 6,
              color: 'var(--accent1)',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent1)';
              e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 201, 255, 0.1)';
              e.currentTarget.style.color = 'var(--accent1)';
            }}
          >
            🔍 SEARCH
          </button>
        </div>
      </form>

      {/* Audit Log Table */}
      <div className="table-card" style={{ border: '1px solid var(--border)' }}>
        <div className="table-header">
          <div className="chart-title">System & Security Audit Logs</div>
          <div className="chart-sub">Traceable transaction and authentication logs</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div
              style={{
                width: 20,
                height: 20,
                border: '2px solid rgba(0, 201, 255, 0.2)',
                borderTop: '2px solid var(--accent1)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 10px auto'
              }}
            />
            Loading audit history...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            NO AUDIT RECORDS FOUND MATCHING YOUR FILTERS.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(26,58,92,0.15)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>TIMESTAMP</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>ACTION</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>USER</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>IP ADDRESS</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>METADATA</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  let badgeColor = 'var(--text-muted)';
                  if (log.action.includes('LOGIN')) badgeColor = 'var(--success, #00e676)';
                  if (log.action.includes('LOGOUT')) badgeColor = 'var(--text-muted)';
                  if (log.action.includes('UPLOAD') || log.action.includes('SYNC')) badgeColor = 'var(--accent1, #00c9ff)';
                  if (log.action.includes('ERROR')) badgeColor = 'var(--danger, #ff3d5a)';
                  if (log.action.includes('CONFIG')) badgeColor = 'var(--warning, #ffd60a)';

                  return (
                    <tr 
                      key={log.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(26,58,92,0.15)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 201, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <span 
                          style={{
                            color: badgeColor,
                            background: `${badgeColor}12`,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontFamily: 'Share Tech Mono, monospace',
                            fontSize: '10.5px',
                            border: `1px solid ${badgeColor}22`
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'Share Tech Mono, monospace' }}>
                        {log.user_email || 'anonymous'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        {log.ip_address || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'Share Tech Mono, monospace', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.metadata ? (
                          <span 
                            title={JSON.stringify(log.metadata, null, 2)}
                            style={{ cursor: 'help', color: 'var(--accent2)' }}
                          >
                            {JSON.stringify(log.metadata)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
