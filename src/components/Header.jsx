import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  fetchAlerts,
  markAlertsRead,
  fetchTimeline,
  fetchAlertRules,
  updateAlertRules
} from '../services/alertService';

function Header({ onOpenCommandPalette }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { liveState, setActiveNav } = useUI();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  
  const [now, setNow] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'timeline' | 'rules'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'info' | 'warning' | 'critical'
  
  // Rules configuration local state
  const [localRules, setLocalRules] = useState([]);

  const drawerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Close drawer on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsDrawerOpen(false);
      }
    }
    if (isDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen]);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  // ─── React Query Hooks ───────────────────────────────────────────────────
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchAlerts(),
    enabled: !!user
  });

  const { data: timelineData } = useQuery({
    queryKey: ['timeline'],
    queryFn: fetchTimeline,
    enabled: !!user
  });

  const { data: rulesData } = useQuery({
    queryKey: ['alert_rules'],
    queryFn: fetchAlertRules,
    enabled: !!user && isAdmin
  });

  // Sync server rules to local form state when fetched
  useEffect(() => {
    if (rulesData?.rules) {
      setLocalRules(rulesData.rules);
    }
  }, [rulesData]);

  const markReadMutation = useMutation({
    mutationFn: (ids) => markAlertsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alerts marked as read');
    }
  });

  const updateRulesMutation = useMutation({
    mutationFn: (rules) => updateAlertRules(rules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
      toast.success('Alert rules updated');
    },
    onError: (err) => {
      toast.error('Failed to update rules: ' + err.message);
    }
  });

  const unreadAlerts = alertsData?.alerts?.filter(a => a.status === 'unread') || [];
  const allAlerts = alertsData?.alerts || [];
  const timelineEvents = timelineData?.events || [];

  const filteredAlerts = allAlerts.filter((alert) => {
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || alert.severity.toUpperCase() === severityFilter.toUpperCase();
    return matchesStatus && matchesSeverity;
  });

  const handleRuleChange = (index, field, value) => {
    const updated = [...localRules];
    updated[index] = { ...updated[index], [field]: value };
    setLocalRules(updated);
  };

  const saveRules = () => {
    updateRulesMutation.mutate(localRules);
  };

  return (
    <div className="header">
      <div className="logo-mark">VM</div>
      <div>
        <div className="logo-text">VELAN METROLOGY</div>
        <div className="logo-sub">PRODUCTION COMMAND CENTER</div>
      </div>
      
      {/* Global Search Trigger */}
      <div 
        onClick={onOpenCommandPalette}
        style={{
          marginLeft: '40px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '13px',
          width: '300px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent1)';
          e.currentTarget.style.background = 'rgba(0, 201, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        <span style={{ fontSize: '14px' }}>🔍</span>
        <span>Search PO, SC, Reports...</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <kbd className="command-kbd" style={{ background: 'var(--bg-card)' }}>Ctrl</kbd>
          <kbd className="command-kbd" style={{ background: 'var(--bg-card)' }}>K</kbd>
        </div>
      </div>

      <div className="header-right">
        {liveState?.active && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,230,118,0.1)',
              border: '1px solid rgba(0,230,118,0.35)',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 10,
              fontFamily: 'Share Tech Mono,monospace',
              color: 'var(--success)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: 'var(--success)',
                borderRadius: '50%',
                animation: 'pulse 1.5s infinite',
                display: 'inline-block',
              }}
            />
            SHEETS LIVE
          </div>
        )}
        <div className="live-badge">
          <div className="live-dot" />
          <span>LIVE</span>
        </div>
        <div className="timestamp">
          {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          &nbsp;
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
        
        {/* Notification Bell Icon */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '5px 10px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
              title="Notifications & Timeline"
            >
              <span style={{ fontSize: '14px' }}>🔔</span>
              {unreadAlerts.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'var(--danger)',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '2px 6px',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    boxShadow: '0 0 8px rgba(255, 61, 90, 0.5)'
                  }}
                >
                  {unreadAlerts.length}
                </span>
              )}
            </button>

            {/* Notification Drawer Popover */}
            {isDrawerOpen && (
              <div
                ref={drawerRef}
                style={{
                  position: 'absolute',
                  top: '35px',
                  right: '0px',
                  width: '380px',
                  maxHeight: '480px',
                  background: 'rgba(10, 18, 30, 0.95)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  fontFamily: 'Share Tech Mono, monospace'
                }}
              >
                {/* Header Tabs */}
                <div
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <button
                    onClick={() => setActiveTab('alerts')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: activeTab === 'alerts' ? 'rgba(0, 201, 255, 0.08)' : 'transparent',
                      border: 'none',
                      borderBottom: activeTab === 'alerts' ? '2px solid var(--accent1)' : 'none',
                      color: activeTab === 'alerts' ? 'var(--accent1)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    ALERTS ({unreadAlerts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: activeTab === 'timeline' ? 'rgba(0, 201, 255, 0.08)' : 'transparent',
                      border: 'none',
                      borderBottom: activeTab === 'timeline' ? '2px solid var(--accent1)' : 'none',
                      color: activeTab === 'timeline' ? 'var(--accent1)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    TIMELINE
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setActiveTab('rules')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: activeTab === 'rules' ? 'rgba(0, 201, 255, 0.08)' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'rules' ? '2px solid var(--accent1)' : 'none',
                        color: activeTab === 'rules' ? 'var(--accent1)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      RULES ⚙️
                    </button>
                  )}
                </div>

                {/* Content Area */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {activeTab === 'alerts' && (
                    <>
                      {/* Premium Filter Controls */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          marginBottom: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>STATUS:</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {['all', 'unread', 'read'].map((s) => (
                              <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                style={{
                                  background: statusFilter === s ? 'var(--accent1)' : 'rgba(255, 255, 255, 0.05)',
                                  border: 'none',
                                  color: statusFilter === s ? '#050b14' : 'var(--text-muted)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '9px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  fontFamily: 'Share Tech Mono, monospace'
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>SEVERITY:</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {['all', 'info', 'warning', 'critical'].map((sev) => {
                              const isActive = severityFilter === sev;
                              let activeBg = 'var(--accent1)';
                              if (sev === 'critical') activeBg = 'var(--danger)';
                              if (sev === 'warning') activeBg = '#ffc107';

                              return (
                                <button
                                  key={sev}
                                  onClick={() => setSeverityFilter(sev)}
                                  style={{
                                    background: isActive ? activeBg : 'rgba(255, 255, 255, 0.05)',
                                    border: 'none',
                                    color: isActive ? '#050b14' : 'var(--text-muted)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    fontFamily: 'Share Tech Mono, monospace'
                                  }}
                                >
                                  {sev}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {unreadAlerts.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                          <button
                            onClick={() => markReadMutation.mutate(null)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent1)',
                              cursor: 'pointer',
                              fontSize: '10px',
                              textDecoration: 'underline',
                              fontFamily: 'Share Tech Mono, monospace'
                            }}
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                      {filteredAlerts.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '11px' }}>
                          No alerts match current filter.
                        </div>
                      ) : (
                        filteredAlerts.slice(0, 30).map((alert) => (
                          <div
                            key={alert.id}
                            className={`alert-card ${alert.status === 'unread' ? 'unread' : ''}`}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span
                                className={`alert-severity-badge ${alert.severity.toLowerCase()}`}
                              >
                                {alert.severity}
                              </span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                {new Date(alert.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{alert.message}</div>
                            
                            {alert.status === 'unread' && (
                              <button
                                onClick={() => markReadMutation.mutate([alert.id])}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  bottom: '8px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '9px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent1)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                              >
                                ✓ Read
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </>
                  )}

                  {activeTab === 'timeline' && (
                    <>
                      {timelineEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                          No operational events logged.
                        </div>
                      ) : (
                        timelineEvents.slice(0, 30).map((event) => (
                          <div
                            key={event.id}
                            style={{
                              borderLeft: '2px solid var(--accent1)',
                              paddingLeft: '10px',
                              marginLeft: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              paddingBottom: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                {event.title}
                              </span>
                              <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                                {new Date(event.created_at).toLocaleDateString('en-IN')} {new Date(event.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{event.description}</div>
                          </div>
                        ))
                      )}
                    </>
                  )}

                  {activeTab === 'rules' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                        Configure Notification Rules & Thresholds:
                      </div>
                      
                      {localRules.map((rule, idx) => (
                        <div
                          key={rule.rule_key}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid var(--border)',
                            padding: '8px',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{rule.rule_name}</span>
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={(e) => handleRuleChange(idx, 'enabled', e.target.checked)}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                            <span>Threshold:</span>
                            <input
                              type="number"
                              value={rule.threshold_value}
                              onChange={(e) => handleRuleChange(idx, 'threshold_value', parseInt(e.target.value, 10) || 0)}
                              style={{
                                width: '60px',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid var(--border)',
                                color: 'white',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                fontFamily: 'Share Tech Mono'
                              }}
                            />
                            <span>{rule.category === 'PRODUCTION' ? 'units' : 'days'}</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
                            <span>Email Recipients:</span>
                            <input
                              type="text"
                              value={rule.recipients || ''}
                              onChange={(e) => handleRuleChange(idx, 'recipients', e.target.value)}
                              placeholder="comma-separated emails"
                              style={{
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid var(--border)',
                                color: 'white',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                fontFamily: 'Share Tech Mono',
                                width: '100%'
                              }}
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={saveRules}
                        disabled={updateRulesMutation.isPending}
                        style={{
                          background: 'rgba(0, 201, 255, 0.15)',
                          border: '1px solid rgba(0, 201, 255, 0.4)',
                          color: 'var(--accent1)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          transition: 'all 0.2s',
                          marginTop: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 201, 255, 0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 201, 255, 0.15)'}
                      >
                        {updateRulesMutation.isPending ? 'SAVING...' : 'SAVE RULES CONFIG'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleTheme}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 10px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.borderColor = 'var(--border-bright)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--accent5)' }}
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--accent6)' }}
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveNav('upload');
              navigate('/upload');
            }}
            style={{
              background: 'rgba(0,201,255,0.1)',
              border: '1px solid rgba(0,201,255,0.3)',
              color: 'var(--accent1)',
              borderRadius: 8,
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'Share Tech Mono,monospace',
              fontWeight: 700,
            }}
          >
            📊 CONNECT SHEETS
          </button>
        )}

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(26, 58, 92, 0.4)',
                border: '1px solid var(--border-bright)',
                padding: '4px 12px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'Share Tech Mono, monospace',
              }}
            >
              <span style={{ fontSize: 13 }}>{isAdmin ? '👑' : '👤'}</span>
              <span>
                {isAdmin ? 'Admin' : 'User'}:{' '}
                <span style={{ color: 'var(--accent1)' }}>{user}</span>
              </span>
            </div>

            <button
              onClick={handleSignOut}
              style={{
                background: 'rgba(255, 61, 90, 0.1)',
                border: '1px solid rgba(255, 61, 90, 0.35)',
                color: 'var(--danger)',
                borderRadius: 8,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'Share Tech Mono, monospace',
                fontWeight: 700,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 61, 90, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(255, 61, 90, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 61, 90, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 61, 90, 0.35)';
              }}
            >
              🚪 SIGN OUT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(Header);
