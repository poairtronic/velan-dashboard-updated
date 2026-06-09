import React from 'react';

export default function ErrorFallback({ error, resetErrorBoundary }) {
  const isDevelopment = import.meta.env.MODE === 'development';

  return (
    <div
      style={{
        padding: 40,
        fontFamily: 'Share Tech Mono, monospace',
        color: '#ff3d5a',
        background: '#050b14',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 16 }}>⚠ Something went wrong.</div>
      <div style={{ fontSize: 14, color: '#7ba7cc', marginBottom: 24 }}>
        An unexpected error occurred while rendering this component.
      </div>

      {isDevelopment && error && (
        <div
          style={{
            fontSize: 12,
            color: '#3d6080',
            background: 'rgba(255,61,90,0.08)',
            border: '1px solid rgba(255,61,90,0.2)',
            borderRadius: 8,
            padding: 16,
            maxWidth: '80%',
            overflow: 'auto',
            wordBreak: 'break-all',
            marginBottom: 24,
          }}
        >
          <pre style={{ margin: 0 }}>{String(error.stack || error.message || error)}</pre>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        <button
          onClick={resetErrorBoundary}
          style={{
            padding: '10px 20px',
            background: 'rgba(0,201,255,0.1)',
            border: '1px solid rgba(0,201,255,0.3)',
            color: '#00c9ff',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.target.style.background = 'rgba(0,201,255,0.2)')}
          onMouseOut={(e) => (e.target.style.background = 'rgba(0,201,255,0.1)')}
        >
          🔄 Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#cbd5e1',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.target.style.background = 'rgba(255,255,255,0.1)')}
          onMouseOut={(e) => (e.target.style.background = 'rgba(255,255,255,0.05)')}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
