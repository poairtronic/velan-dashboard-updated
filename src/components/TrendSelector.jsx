import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

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

  return (
    <div style={{ marginTop: '10px', height: '60px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-25px', right: '0', display: 'flex', gap: '4px', zIndex: 10 }}>
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
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          Loading trend...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis domain={['auto', 'auto']} hide />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="var(--accent1)" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TrendSelector;
