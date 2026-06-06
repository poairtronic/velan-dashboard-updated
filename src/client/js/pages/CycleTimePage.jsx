// ─── CYCLE TIME PAGE COMPONENT ────────────────────────────────────────────────

function CycleTimePage() {
  const { kpis, filtered } = useDashboard();
  const ctBarRef  = React.useRef();
  const ctLineRef = React.useRef();

  const cts = kpis.stageCycleTimes
    .filter(s => !['STOCK','RM','STORE','STORES'].includes(s.stage))
    .sort((a, b) => {
      const stageOrder = ['HOV','BLV','HCV','FBV','HTV','SDV','LATHE','M1','FB','HT','SZ','BLK','CG','SG','SD','HO','CA','WC','VA','QC','DCPLI','READY'];
      const aIdx = stageOrder.indexOf(a.stage);
      const bIdx = stageOrder.indexOf(b.stage);
      return (aIdx >= 0 ? aIdx : 1000) - (bIdx >= 0 ? bIdx : 1000);
    })
    .map(s => ({ ...s, duration: Math.round(s.duration), avgToReach: Math.round(s.avgToReach) }));
  
  const maxDur = Math.max(...cts.map(c => c.duration), 1);

  useChart(ctBarRef, {
    type: 'bar',
    data: {
      labels: cts.map(c => c.stage),
      datasets: [
        {
          label: 'Avg Duration (days)',
          data: cts.map(c => c.duration),
          backgroundColor: cts.map(c => {
            if (c.duration >= maxDur * 0.7) return '#ff3d5a99';
            if (c.duration >= maxDur * 0.4) return '#ffd60a99';
            return '#00c9ff99';
          }),
          borderColor: cts.map(c => {
            if (c.duration >= maxDur * 0.7) return '#ff3d5a';
            if (c.duration >= maxDur * 0.4) return '#ffd60a';
            return '#00c9ff';
          }),
          borderWidth: 1, borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.y} days avg in stage` } } },
      scales: {
        x: { ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' }, title: { display: true, text: 'Days in Stage', color: '#7ba7cc' } }
      }
    }
  }, [kpis]);

  const flowStages = [...cts].sort((a, b) => a.avgToReach - b.avgToReach);
  useChart(ctLineRef, {
    type: 'line',
    data: {
      labels: flowStages.map(c => c.stage),
      datasets: [{
        label: 'Avg Days to Reach Stage',
        data: flowStages.map(c => c.avgToReach),
        borderColor: '#00c9ff', backgroundColor: 'rgba(0,201,255,0.1)',
        borderWidth: 2, pointRadius: 5, pointBackgroundColor: '#00c9ff',
        tension: 0.3, fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7ba7cc' } }, tooltip: { callbacks: { label: c => `${c.parsed.y} days from PO date` } } },
      scales: {
        x: { ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' }, title: { display: true, text: 'Days from PO Date', color: '#7ba7cc' } }
      }
    }
  }, [kpis]);

  const totalAvgCycle = kpis.avgOverallCycle;
  const slowestStage = cts.length > 0 ? [...cts].reduce((a, b) => b.duration > a.duration ? b : a) : { stage: '—', duration: 0 };
  const fastestStage = cts.filter(c => c.duration > 0).length > 0 ? cts.filter(c => c.duration > 0).reduce((a, b) => b.duration < a.duration ? b : a) : { stage: '—', duration: 0 };

  return (
    <div>
      <div className="section-title">⏱ Cycle Time <span>per Stage</span><div className="section-line"/></div>
      <div style={{ background: 'rgba(0,201,255,0.06)', border: '1px solid rgba(0,201,255,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono,monospace' }}>
        ℹ FORMULA: Avg days in stage = Mean of (Next Stage Timestamp − Current Stage Timestamp) for each item SC transition. Time component ignored — date only. This measures actual time spent in each stage from one timestamp to the next.
      </div>

      <div className="kpi-grid">
        <KPICard label="AVG OVERALL CYCLE" value={totalAvgCycle != null ? `${totalAvgCycle} days` : '—'} sub="avg from PO date to last timestamp date · date only" color1="#00c9ff" color2="#0fa8e0"/>
        <KPICard label="SLOWEST STAGE" value={slowestStage?.stage || '—'} sub={`~${slowestStage?.duration || 0} days avg at stage`} color1="#ff3d5a" color2="#ff6b35" badge={{ text: 'BOTTLENECK', cls: 'badge-red' }}/>
        <KPICard label="FASTEST STAGE" value={fastestStage?.stage || '—'} sub={`~${fastestStage?.duration || 0} days avg at stage`} color1="#00e676" color2="#00c9ff" badge={{ text: 'QUICK', cls: 'badge-green' }}/>
        <KPICard label="STAGES TRACKED" value={cts.length} sub="stages with cycle data" color1="#ffd60a" color2="#b24bff"/>
        <KPICard label="TARGET" value="21 days" sub="total PO cycle target" color1="#ffd60a" color2="#ff6b35"/>
        <KPICard label="ITEMS WITH DATA" value={filtered.filter(r => r.timestamp && r.poDate).length} sub="items with both dates" color1="#b24bff" color2="#00c9ff"/>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">⏱ Avg Duration at Each Stage</div>
          <div className="chart-sub">DATE-ONLY CALC · RED=SLOW · YELLOW=MODERATE · GREEN=FAST</div>
          <div className="chart-wrap-lg"><canvas ref={ctBarRef}/></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">📈 Cumulative Days to Reach Stage</div>
          <div className="chart-sub">AVG DAYS FROM PO RECEIVED DATE → EACH STAGE</div>
          <div className="chart-wrap-lg"><canvas ref={ctLineRef}/></div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div className="chart-title">Stage Cycle Time — Full Detail</div>
          <div style={{ fontSize: 10, fontFamily: 'Share Tech Mono', color: 'var(--text-muted)' }}>AVG DURATION IN STAGE = Mean of (Next Timestamp − Current Timestamp) for each item transition from one stage to next</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>STAGE</th>
                <th>AVG DAYS TO REACH</th>
                <th>AVG DURATION IN STAGE</th>
                <th>ITEMS COUNTED</th>
                <th>VS 21-DAY TARGET</th>
                <th>RATING</th>
                <th>BAR</th>
              </tr>
            </thead>
            <tbody>
              {[...cts].sort((a, b) => a.avgToReach - b.avgToReach).map((c, i) => {
                const pct = Math.min(100, Math.round(c.duration / maxDur * 100));
                const color = pct >= 70 ? 'var(--danger)' : pct >= 40 ? 'var(--warning)' : 'var(--success)';
                const rating = pct >= 70 ? '🔴 SLOW' : pct >= 40 ? '🟡 MODERATE' : '🟢 FAST';
                const vsTarget = c.avgToReach > TARGET_DAYS ? `+${c.avgToReach - TARGET_DAYS}d over` : `-${TARGET_DAYS - c.avgToReach}d under`;
                const vsColor = c.avgToReach > TARGET_DAYS ? 'var(--danger)' : 'var(--success)';
                return (
                  <tr key={i}>
                    <td><span className="status-pill" style={{ background: getStageColor(c.stage) + '22', color: getStageColor(c.stage) }}>{c.stage}</span></td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 17, color: 'var(--accent1)' }}>{Math.round(c.avgToReach)}d</td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 17, color }}>{Math.round(c.duration)}d</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.count}</td>
                    <td style={{ color: vsColor, fontWeight: 700, fontSize: 12 }}>{vsTarget}</td>
                    <td style={{ fontSize: 11 }}>{rating}</td>
                    <td style={{ minWidth: 100 }}>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
