import React from 'react';

export function DashboardSkeleton() {
  return (
    <div style={{ padding: '20px' }}>
      <div className="skeleton skeleton-title" style={{ width: '250px', marginBottom: '24px' }}></div>
      <div className="kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: '110px' }}>
            <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
            <div className="skeleton skeleton-title" style={{ width: '80%', height: '32px' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <div className="skeleton-card" style={{ height: '300px' }}></div>
        <div className="skeleton-card" style={{ height: '300px' }}></div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px' }}>
      <div className="skeleton skeleton-title" style={{ width: '150px', marginBottom: '20px' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-text" style={{ height: '24px' }}></div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="skeleton-card" style={{ height: '250px', width: '100%' }}>
      <div className="skeleton skeleton-title" style={{ width: '120px' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '80px', marginBottom: 'auto' }}></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '150px', marginTop: '20px' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div 
            key={i} 
            className="skeleton" 
            style={{ 
              flex: 1, 
              height: `${Math.random() * 80 + 20}%`, 
              borderRadius: '4px 4px 0 0' 
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
