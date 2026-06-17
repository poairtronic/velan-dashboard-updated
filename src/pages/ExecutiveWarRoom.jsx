import React, { useEffect, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { ShieldAlert, AlertTriangle, Zap } from 'lucide-react';

export default function ExecutiveWarRoom() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchWarRoom = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/executive/war-room', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch War Room data');
        const json = await res.json();
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    fetchWarRoom();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <LoadingScreen message="Loading Executive War Room..." />;
  if (error) return <div style={{ padding: '40px', color: 'var(--danger)', textAlign: 'center' }}>Error: {error}</div>;
  if (!data) return null;

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          Executive <span>War Room</span>
          <div className="section-line" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        
        {/* Column 1: Critical Issues */}
        <div className="chart-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert color="var(--danger)" size={18}/> Critical Issues
          </div>
          <div className="chart-sub">STAGE QUEUES EXCEEDING THRESHOLD</div>
          <div style={{ marginTop: '15px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
            {data.criticalIssues.length === 0 ? (
              <div style={{ color: 'var(--success)', textAlign: 'center', padding: '20px' }}>No critical queue issues detected.</div>
            ) : (
              data.criticalIssues.map((issue, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{issue.stage}</span>
                    <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Q: {issue.queueSize}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Affected POs: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{issue.affectedPOs}</span></span>
                    <span style={{ color: 'var(--text-muted)' }}>Delay Risk: <span style={{ color: 'var(--accent2)', fontWeight: 'bold' }}>+{issue.delayRiskDays}d</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Operational Risks */}
        <div className="chart-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle color="var(--warning)" size={18}/> Operational Risks
          </div>
          <div className="chart-sub">POs CLOSE TO OR PAST EXPECTED COMPLETION</div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', textAlign: 'center', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>CRITICAL</div>
              <div style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{data.operationalRisks.Critical}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.1)', textAlign: 'center', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold' }}>HIGH</div>
              <div style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{data.operationalRisks.High}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', textAlign: 'center', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>MEDIUM</div>
              <div style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{data.operationalRisks.Medium}</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>PO</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Stage</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>Age</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.operationalRisks.items.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--accent1)' }}>{r.po}</td>
                    <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{r.stage}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>{r.age}d</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{ color: r.riskLevel === 'Critical' ? '#ef4444' : (r.riskLevel === 'High' ? '#ef4444' : '#f59e0b'), fontWeight: 'bold' }}>{r.riskLevel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 3: Priority Actions */}
        <div className="chart-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap color="var(--accent1)" size={18}/> Priority Actions
          </div>
          <div className="chart-sub">AUTOMATED SYSTEM RECOMMENDATIONS</div>
          <div style={{ marginTop: '15px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
            {data.priorityActions.length === 0 ? (
              <div style={{ color: 'var(--success)', textAlign: 'center', padding: '20px' }}>No priority actions required at this time.</div>
            ) : (
              data.priorityActions.map((action, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', border: `1px solid ${action.priority === 'Critical' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`, padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>{action.action}</span>
                    <span style={{ fontSize: '10px', background: action.priority === 'Critical' ? '#ef4444' : '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {action.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    {action.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Aff. POs: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{action.affectedPOs}</span></span>
                    <span style={{ color: 'var(--text-muted)' }}>Saved Delay Risk: <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{action.riskDays}d</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
