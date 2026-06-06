// ─── HEADER UI COMPONENT ──────────────────────────────────────────────────────

function Header() {
  const { liveState, now, setActiveNav } = useDashboard();

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
          onClick={() => setActiveNav('upload')}
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
      </div>
    </div>
  );
}
