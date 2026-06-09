import React from 'react';
import { DashboardSkeleton } from './ui/skeletons/Skeletons';

function LoadingScreen() {
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
