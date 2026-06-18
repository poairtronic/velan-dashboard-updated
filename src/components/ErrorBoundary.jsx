import React from 'react';
import { apiBase } from '../services/apiClient';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React Error Boundary]', error, errorInfo);
    
    // Log to audit logger database table via API
    const logPayload = {
      action: 'FRONTEND_ERROR',
      entityType: 'frontend_error_boundary',
      metadata: {
        message: error.message || String(error),
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || ''
      }
    };

    fetch(`${apiBase}/api/audit/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logPayload)
    }).catch(err => console.error('Failed to log frontend error to audit log:', err));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          style={{
            padding: '30px',
            background: 'rgba(255, 61, 90, 0.04)',
            border: '1px solid var(--danger, #ff3d5a)',
            borderRadius: '12px',
            margin: '20px auto',
            maxWidth: '600px',
            fontFamily: 'Exo 2, sans-serif',
            textAlign: 'center',
            boxShadow: '0 0 30px rgba(255, 61, 90, 0.15)'
          }}
        >
          <h3 
            style={{ 
              color: 'var(--danger, #ff3d5a)', 
              fontFamily: 'Rajdhani', 
              fontSize: '22px', 
              fontWeight: 700,
              letterSpacing: '0.5px',
              margin: '0 0 10px 0'
            }}
          >
            ⚠️ SYSTEM MODULE RENDERING FAULT
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            An unexpected error occurred while rendering this module of the command center. 
            The system has automatically logged this incident for diagnostics.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: 'var(--danger, #ff3d5a)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              fontFamily: 'Share Tech Mono, monospace'
            }}
          >
            RELOAD MODULE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
