import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../hooks/useAuth';
// ─── HEADER UI COMPONENT ──────────────────────────────────────────────────────

function Header() {
  const { liveState, now, setActiveNav, theme, toggleTheme } = useDashboard();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="header">
      <div className="logo-mark">VM</div>
      <div>
        <div className="logo-text">VELAN METROLOGY</div>
        <div className="logo-sub">PRODUCTION COMMAND CENTER</div>
      </div>
      <div className="header-right">
        {liveState?.active && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0,230,118,0.1)',
            border: '1px solid rgba(0,230,118,0.35)',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 10,
            fontFamily: 'Share Tech Mono,monospace',
            color: 'var(--success)'
          }}>
            <span style={{
              width: 6,
              height: 6,
              background: 'var(--success)',
              borderRadius: '50%',
              animation: 'pulse 1.5s infinite',
              display: 'inline-block'
            }}/>
            SHEETS LIVE
          </div>
        )}
        <div className="live-badge">
          <div className="live-dot"/>
          <span>LIVE</span>
        </div>
        <div className="timestamp">
          {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          &nbsp;
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent5)' }}>
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent6)' }}>
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
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
              fontWeight: 700
            }}
          >
            📊 CONNECT SHEETS
          </button>
        )}

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
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
              fontFamily: 'Share Tech Mono, monospace'
            }}>
              <span style={{ fontSize: 13 }}>{isAdmin ? '👑' : '👤'}</span>
              <span>{isAdmin ? 'Admin' : 'User'}: <span style={{ color: 'var(--accent1)' }}>{user}</span></span>
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
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 61, 90, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(255, 61, 90, 0.6)';
              }}
              onMouseLeave={e => {
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