import React, { useState, useEffect } from 'react';

function TrendSelector({ metric }) {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const token = localStorage.getItem('token');
    fetch(`/api/kpi/history?metric=${metric}&range=${range.replace('d', '')}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.json();
      })
      .then(json => {
        if (isMounted) {
          if (Array.isArray(json)) {
            setData(json);
          } else {
            console.error('Expected array for trend data, got:', json);
            setData([]);
          }
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Trend fetch error:', err);
        if (isMounted) {
          setData([]);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [metric, range]);

  const avg = data.length > 0 
    ? Math.round(data.reduce((sum, item) => sum + item.value, 0) / data.length)
    : 0;

  const formatAvg = () => {
    if (metric === 'otd') return `${avg}%`;
    if (metric === 'production') return `${avg} units`;
    if (metric === 'bottleneck') return `${avg} items`;
    return `${avg}%`; // Default/fallback score percentage
  };

  return (
    <div style={{ marginTop: '10px', height: '52px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-22px', right: '0', display: 'flex', gap: '4px', zIndex: 10 }}>
        {['7d', '30d', '90d'].map(r => (
          <span 
            key={r}
            onClick={(e) => { e.stopPropagation(); setRange(r); }}
            style={{ 
              fontSize: '10px', 
              padding: '2px 6px', 
              borderRadius: '4px',
              cursor: 'pointer',
              background: range === r ? 'var(--accent1)' : 'var(--bg-tertiary)',
              color: range === r ? '#000' : 'var(--text-muted)',
              fontFamily: 'Share Tech Mono'
            }}
          >
            {r.toUpperCase()}
          </span>
        ))}
      </div>
      
      {loading ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px' }}>
          Loading trend...
        </div>
      ) : (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 201, 255, 0.04)',
          border: '1px dashed rgba(0, 201, 255, 0.15)',
          borderRadius: '6px',
          fontFamily: 'Share Tech Mono'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Average ({range.toUpperCase()})
          </div>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent1)', marginTop: '2px', textShadow: '0 0 6px rgba(0, 201, 255, 0.3)' }}>
            {formatAvg()}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrendSelector;
