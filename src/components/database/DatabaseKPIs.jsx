import React from 'react';

function DatabaseKPIs({ kpiStats, fromDate, toDate, dateType, setSelectedKPI }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <div className="kpi-card" style={{ '--c1': '#00c9ff', '--c2': '#0fa8e0' }}>
        <div className="kpi-label">TOTAL POs</div>
        <div className="kpi-value">{kpiStats.totalPOCount}</div>
        <div className="kpi-sub">
          all POs in database
          {(fromDate || toDate) && (
            <span
              style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--accent1)' }}
            >
              {kpiStats.uniquePO} in selected range
            </span>
          )}
        </div>
      </div>
      <div className="kpi-card" style={{ '--c1': '#b24bff', '--c2': '#00c9ff' }}>
        <div className="kpi-label">TOTAL SCs</div>
        <div className="kpi-value">{kpiStats.totalSCCount}</div>
        <div className="kpi-sub">
          unique SC sets in database (1211-1 &amp; 1211-2 = 1 set)
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {[
              { label: 'READY', val: kpiStats.scStageCounts?.READY, c: 'var(--success)' },
              { label: 'STORES', val: kpiStats.scStageCounts?.STORES, c: 'var(--accent1)' },
              { label: 'STOCK', val: kpiStats.scStageCounts?.STOCK, c: 'var(--warning)' },
              { label: 'EXSTOCK', val: kpiStats.scStageCounts?.EXSTOCK, c: 'var(--accent6)' },
            ].map((s) => (
              <span
                key={s.label}
                style={{
                  fontSize: 9,
                  fontFamily: 'Share Tech Mono,monospace',
                  color: s.val > 0 ? s.c : 'var(--text-muted)',
                  background: s.val > 0 ? s.c + '22' : 'rgba(255,255,255,0.04)',
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
              >
                {s.label}: {s.val || 0}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="kpi-card" style={{ '--c1': '#ffd60a', '--c2': '#ff6b35' }}>
        <div className="kpi-label">SC {dateType === 'timestamp' ? 'UPDATED' : 'RECEIVED'}</div>
        <div className="kpi-value" style={{ color: 'var(--accent5)' }}>
          {kpiStats.scReceived}
        </div>
        <div className="kpi-sub">
          SCs with {dateType === 'timestamp' ? 'timestamp' : 'PO date'} in range
          {fromDate && (
            <span
              style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}
            >
              from {fromDate}
            </span>
          )}
          {toDate && (
            <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)' }}>
              to {toDate}
            </span>
          )}
          {!fromDate && !toDate && (
            <span
              style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}
            >
              all dates
            </span>
          )}
        </div>
      </div>
      <div
        className="kpi-card"
        style={{ '--c1': '#00e676', '--c2': '#00c9ff', cursor: 'pointer' }}
        onClick={() => setSelectedKPI('scCompleted')}
      >
        <div className="kpi-label">SC COMPLETED</div>
        <div className="kpi-value" style={{ color: 'var(--success)' }}>
          {kpiStats.scCompleted}
        </div>
        <div className="kpi-sub">
          all items READY/STOCK/STORES/EXSTOCK
          {fromDate && (
            <span
              style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}
            >
              from {fromDate}
            </span>
          )}
          {toDate && (
            <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)' }}>
              to {toDate}
            </span>
          )}
          {!fromDate && !toDate && (
            <span
              style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}
            >
              all dates
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedKPI('scCompletedPlusVA');
          }}
          style={{
            marginTop: 10,
            padding: '4px 10px',
            border: '1px solid rgba(255,107,53,0.5)',
            background: 'rgba(255,107,53,0.1)',
            color: 'var(--accent4)',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Share Tech Mono,monospace',
            letterSpacing: 0.5,
          }}
          title="View SC Completed including VA stage"
        >
          +VA View ({kpiStats.scCompletedPlusVA})
        </button>
      </div>
    </div>
  );
}

export default React.memo(DatabaseKPIs);

