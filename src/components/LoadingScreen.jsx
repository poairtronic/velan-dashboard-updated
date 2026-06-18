import React, { useEffect, useState } from 'react';
import { DashboardSkeleton } from './ui/skeletons/Skeletons';

function LoadingScreen() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div 
        style={{ 
          width: '100%', 
          minHeight: '80vh', 
          padding: '40px', 
          textAlign: 'center', 
          fontFamily: 'Exo 2, sans-serif' 
        }}
      >
        <h3 
          style={{ 
            color: 'var(--warning, #ffd60a)', 
            fontFamily: 'Rajdhani', 
            fontSize: '20px', 
            fontWeight: 700,
            marginBottom: '10px' 
          }}
        >
          ⏳ SYSTEM LOADING TIMEOUT
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
          Retrieving calculations is taking longer than usual. This might be due to heavy database query load or network speed.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: 'rgba(0, 201, 255, 0.1)',
            border: '1px solid var(--accent1)',
            borderRadius: '6px',
            color: 'var(--accent1)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'Share Tech Mono, monospace'
          }}
        >
          FORCE RELOAD
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '80vh' }}>
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
        <div
          style={{
            width: 16,
            height: 16,
            border: '2px solid rgba(0, 201, 255, 0.2)',
            borderTop: '2px solid var(--accent1)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '11px', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1 }}>
          LOADING DATA...
        </span>
      </div>
      <DashboardSkeleton />
    </div>
  );
}

export default LoadingScreen;
