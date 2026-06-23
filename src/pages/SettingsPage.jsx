import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

function SettingsPage() {
  const [settings, setSettings] = useState([
    { setting_key: 'po_delay_alert', enabled: false, recipients: '' },
    { setting_key: 'weekly_summary', enabled: false, recipients: '' }
  ]);
  const [logs, setLogs] = useState([]);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const fetchSettingsAndLogs = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      
      const [settingsRes, logsRes] = await Promise.all([
        fetch(`${apiBase}/api/notifications/settings`, { credentials: 'include' }),
        fetch(`${apiBase}/api/notifications/logs`, { credentials: 'include' })
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        // Merge with defaults
        const newSettings = settings.map(s => {
          const found = data.find(d => d.setting_key === s.setting_key);
          return found || s;
        });
        setSettings(newSettings);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      const res = await fetch(`${apiBase}/api/notifications/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings })
      });
      
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (err) {
      toast.error('Network error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }
    
    setSendingTest(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      const res = await fetch(`${apiBase}/api/notifications/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: testEmail })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Test email sent successfully');
        fetchSettingsAndLogs(); // Refresh logs
      } else {
        toast.error(data.error || 'Failed to send test email');
      }
    } catch (err) {
      toast.error('Network error sending test email');
    } finally {
      setSendingTest(false);
    }
  };

  const updateSetting = (key, field, value) => {
    setSettings(prev => prev.map(s => 
      s.setting_key === key ? { ...s, [field]: value } : s
    ));
  };

  if (loading) return <div style={{ padding: 20, color: '#e2e8f0' }}>Loading settings...</div>;

  const poDelay = settings.find(s => s.setting_key === 'po_delay_alert') || {};
  const weeklySummary = settings.find(s => s.setting_key === 'weekly_summary') || {};

  return (
    <div style={{ padding: '20px', color: '#e2e8f0', fontFamily: 'Share Tech Mono, monospace' }}>
      <h2 style={{ color: '#00c9ff', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Settings → Email Notifications
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* CONFIGURATION CARD */}
        <div style={{ background: '#050b14', border: '1px solid rgba(0,201,255,0.2)', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ borderBottom: '1px solid rgba(0,201,255,0.2)', paddingBottom: '10px', marginBottom: '20px' }}>Notification Configuration</h3>
          
          {/* PO Delay Alert */}
          <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong>PO Delay Alerts (&gt;21 Days)</strong>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={poDelay.enabled || false}
                  onChange={(e) => updateSetting('po_delay_alert', 'enabled', e.target.checked)}
                  style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#00c9ff' }}
                />
                Enabled
              </label>
            </div>
            <input 
              type="text" 
              placeholder="Recipients (comma separated)"
              value={poDelay.recipients || ''}
              onChange={(e) => updateSetting('po_delay_alert', 'recipients', e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,201,255,0.3)', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Weekly Summary */}
          <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong>Weekly Production Summary (Mon 08:00 AM)</strong>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={weeklySummary.enabled || false}
                  onChange={(e) => updateSetting('weekly_summary', 'enabled', e.target.checked)}
                  style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#00c9ff' }}
                />
                Enabled
              </label>
            </div>
            <input 
              type="text" 
              placeholder="Recipients (comma separated)"
              value={weeklySummary.recipients || ''}
              onChange={(e) => updateSetting('weekly_summary', 'recipients', e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,201,255,0.3)', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ width: '100%', padding: '10px', background: '#00c9ff', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* TEST EMAIL CARD */}
        <div style={{ background: '#050b14', border: '1px solid rgba(0,201,255,0.2)', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ borderBottom: '1px solid rgba(0,201,255,0.2)', paddingBottom: '10px', marginBottom: '20px' }}>System Diagnosis</h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '15px' }}>
            Verify Gmail SMTP functionality by sending a test email. Do not use personal accounts; ensure the system account is configured.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="email" 
              placeholder="Test Recipient Email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,201,255,0.3)', color: '#fff', borderRadius: '4px' }}
            />
            <button 
              onClick={handleTestEmail}
              disabled={sendingTest}
              style={{ padding: '8px 15px', background: 'transparent', border: '1px solid #00c9ff', color: '#00c9ff', borderRadius: '4px', cursor: sendingTest ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {sendingTest ? 'Sending...' : 'Test'}
            </button>
          </div>
        </div>
      </div>

      {/* LOGS TABLE */}
      <div style={{ marginTop: '20px', background: '#050b14', border: '1px solid rgba(0,201,255,0.2)', borderRadius: '8px', padding: '20px', overflowX: 'auto' }}>
        <h3 style={{ borderBottom: '1px solid rgba(0,201,255,0.2)', paddingBottom: '10px', marginBottom: '20px' }}>Notification Audit Trail</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,201,255,0.1)', color: '#00c9ff' }}>
              <th style={{ padding: '10px' }}>Date</th>
              <th style={{ padding: '10px' }}>Type</th>
              <th style={{ padding: '10px' }}>PO Number</th>
              <th style={{ padding: '10px' }}>Recipient</th>
              <th style={{ padding: '10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No notification logs found</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px', fontSize: '14px' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '10px', fontSize: '14px' }}>
                    <span style={{ padding: '2px 6px', background: log.type === 'PO_DELAY' ? 'rgba(225,29,72,0.2)' : 'rgba(14,165,233,0.2)', color: log.type === 'PO_DELAY' ? '#e11d48' : '#0ea5e9', borderRadius: '4px', fontSize: '12px' }}>
                      {log.type}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontSize: '14px' }}>{log.poNumber || '-'}</td>
                  <td style={{ padding: '10px', fontSize: '14px' }}>{log.recipient}</td>
                  <td style={{ padding: '10px', fontSize: '14px' }}>
                    <span style={{ color: log.status === 'success' ? '#22c55e' : '#ef4444' }}>
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SettingsPage;
