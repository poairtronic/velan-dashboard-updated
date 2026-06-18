import React from 'react';

export default function DataFreshnessTag({ metadata }) {
  if (!metadata || !metadata.lastSyncTime) {
    return (
      <div 
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          marginTop: '8px',
          fontFamily: 'Share Tech Mono, monospace',
          letterSpacing: '0.5px'
        }}
      >
        No sync data available
      </div>
    );
  }

  const { lastSyncTime, confidenceScore, freshnessSeconds } = metadata;
  
  // Format lastSyncTime to local time format (e.g. "4:15 PM")
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
      return 'Unknown';
    }
  };

  const timeStr = formatTime(lastSyncTime);
  
  // Color code: green if < 15m (900s), yellow if 15-60m (900s-3600s), red if > 60m (3600s)
  let color = 'var(--success, #00e676)';
  if (freshnessSeconds > 3600) {
    color = 'var(--danger, #ff3d5a)';
  } else if (freshnessSeconds > 900) {
    color = 'var(--warning, #ffd60a)';
  }

  return (
    <div 
      style={{
        fontSize: '10.5px',
        color: color,
        marginTop: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '500',
        fontFamily: 'Share Tech Mono, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '3px 8px',
        borderRadius: '4px',
        width: 'max-content',
        border: `1px solid ${color}22`
      }}
    >
      <span 
        style={{ 
          display: 'inline-block', 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`
        }} 
      />
      Sync: {timeStr} · Conf: {confidenceScore}%
    </div>
  );
}
