// ─── LOADING SCREEN UI COMPONENT ──────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      fontFamily: 'Share Tech Mono, monospace',
      color: 'var(--accent1)'
    }}>
      <div style={{
        width: 50,
        height: 50,
        border: '3px solid rgba(0, 201, 255, 0.1)',
        borderTop: '3px solid var(--accent1)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: 16
      }}/>
      <div style={{ letterSpacing: 2 }}>LOADING PRODUCTION METRICS...</div>
    </div>
  );
}
