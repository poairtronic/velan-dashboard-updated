import React, { useState, useEffect } from 'react';
import { apiBase, apiClient } from '../services/apiClient';
import { toast } from 'react-hot-toast';

export default function DataQualityDashboard() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await apiClient(`${apiBase}/api/data-quality/issues`);
      const data = await res.json();
      if (data.success) {
        setIssues(data.issues || []);
      } else {
        toast.error('Failed to load quality issues.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to retrieve issues from server.');
    } finally {
      setLoading(false);
    }
  };

  const runScan = async () => {
    try {
      setScanning(true);
      const res = await apiClient(`${apiBase}/api/data-quality/scan`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Scan completed. Found ${data.issueCount} open issues.`);
        fetchIssues();
      } else {
        toast.error('Scan failed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Data scan request failed.');
    } finally {
      setScanning(false);
    }
  };

  const resolveIssue = async (id) => {
    try {
      const res = await apiClient(`${apiBase}/api/data-quality/resolve/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Issue marked as resolved.');
        setIssues(prev => prev.filter(issue => issue.id !== id));
      } else {
        toast.error('Failed to resolve issue.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Resolution failed.');
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Compute issue category counts
  const categoryCounts = issues.reduce((acc, issue) => {
    acc[issue.issue_type] = (acc[issue.issue_type] || 0) + 1;
    return acc;
  }, {
    MISSING_PO: 0,
    MISSING_VENDOR: 0,
    INVALID_STAGE: 0,
    DUPLICATE_SC: 0,
    DUPLICATE_PO_CONFLICT: 0,
    BAD_DATE: 0
  });

  const getIssueLabel = (type) => {
    switch (type) {
      case 'MISSING_PO': return 'Missing PO Number';
      case 'MISSING_VENDOR': return 'Missing Vendor Name';
      case 'INVALID_STAGE': return 'Invalid Stage Value';
      case 'DUPLICATE_SC': return 'Duplicate SC Numbers';
      case 'DUPLICATE_PO_CONFLICT': return 'Conflicting PO Data';
      case 'BAD_DATE': return 'Date Format/Logic Error';
      default: return type;
    }
  };

  const getSeverityColor = (type) => {
    if (['MISSING_PO', 'DUPLICATE_PO_CONFLICT', 'BAD_DATE'].includes(type)) return 'var(--danger, #ff3d5a)';
    return 'var(--warning, #ffd60a)';
  };

  return (
    <div style={{ fontFamily: 'Exo 2, sans-serif' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          Data Quality <span>Governance</span>
          <div className="section-line" />
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, var(--accent1) 0%, #0fa8e0 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(0, 201, 255, 0.3)',
            transition: 'all 0.2s ease',
            opacity: scanning ? 0.7 : 1
          }}
        >
          {scanning ? 'RUNNING SCAN...' : '⚡ RUN SCAN ON DEMAND'}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {Object.entries(categoryCounts).map(([type, count]) => {
          const color = getSeverityColor(type);
          return (
            <div 
              key={type}
              style={{
                background: 'rgba(26,58,92,0.1)',
                border: `1px solid ${count > 0 ? color + '44' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '14px',
                textAlign: 'center',
                boxShadow: count > 0 ? `0 0 10px ${color}11` : 'none'
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 6 }}>
                {getIssueLabel(type).toUpperCase()}
              </div>
              <div 
                style={{ 
                  fontFamily: 'Rajdhani', 
                  fontSize: '28px', 
                  fontWeight: 700, 
                  color: count > 0 ? color : 'var(--text-primary)' 
                }}
              >
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Open Issues Table */}
      <div className="table-card" style={{ border: '1px solid var(--border)' }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="chart-title">Unresolved Quality Issues</div>
            <div className="chart-sub">Open validation flags requiring action</div>
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
            TOTAL OPEN: {issues.length}
          </div>
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
            Loading active issues...
          </div>
        ) : issues.length === 0 ? (
          <div 
            style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: 'var(--success, #00e676)',
              fontFamily: 'Share Tech Mono, monospace' 
            }}
          >
            ✓ DATABASE INTEGRITY VERIFIED — ZERO ISSUES FOUND
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(26,58,92,0.15)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>ISSUE TYPE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>AFFECTED CARD (SC / PO)</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>PRODUCT & STAGE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>FIELD</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>DETECTED AT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => {
                  const color = getSeverityColor(issue.issue_type);
                  return (
                    <tr 
                      key={issue.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(26,58,92,0.2)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 201, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <span 
                          style={{
                            color: color,
                            background: `${color}15`,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontFamily: 'Share Tech Mono, monospace',
                            fontSize: '10px'
                          }}
                        >
                          {getIssueLabel(issue.issue_type)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'Share Tech Mono, monospace' }}>
                        <div>SC: <span style={{ color: 'var(--accent1)' }}>{issue.details.sc || '—'}</span></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          PO: <span style={{ color: 'var(--accent2)' }}>{issue.details.po || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 500 }}>{issue.details.product || 'Unknown Product'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Stage: <strong>{issue.details.currentStage || '—'}</strong> ({issue.details.inhouse})
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        {issue.affected_field}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {new Date(issue.detected_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => resolveIssue(issue.id)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(0, 230, 118, 0.1)',
                            border: '1px solid var(--success, #00e676)',
                            borderRadius: 6,
                            color: 'var(--success, #00e676)',
                            fontFamily: 'Share Tech Mono, monospace',
                            fontSize: '11px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--success, #00e676)';
                            e.currentTarget.style.color = '#000';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 230, 118, 0.1)';
                            e.currentTarget.style.color = 'var(--success, #00e676)';
                          }}
                        >
                          ✓ RESOLVE
                        </button>
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
