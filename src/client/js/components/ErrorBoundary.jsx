import React from 'react';
// ─── ERROR BOUNDARY COMPONENT ──────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          fontFamily: 'Share Tech Mono,monospace',
          color: '#ff3d5a',
          background: '#050b14',
          minHeight: '100vh'
        }}>
          <div style={{ fontSize: 20, marginBottom: 16 }}>⚠ Dashboard Error</div>
          <div style={{ fontSize: 12, color: '#7ba7cc', marginBottom: 12 }}>
            An unexpected error occurred. Please refresh the page.
          </div>
          <div style={{
            fontSize: 11,
            color: '#3d6080',
            background: 'rgba(255,61,90,0.08)',
            border: '1px solid rgba(255,61,90,0.2)',
            borderRadius: 8,
            padding: 16,
            wordBreak: 'break-all'
          }}>
            {String(this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              background: 'rgba(0,201,255,0.1)',
              border: '1px solid rgba(0,201,255,0.3)',
              color: '#00c9ff',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            🔄 Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;