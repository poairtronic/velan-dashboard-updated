// ─── WORK IN PROGRESS (WIP) PAGE COMPONENT ────────────────────────────────────

function WIPPage() {
  const { kpis, filtered } = useDashboard();
  const [expandedItem, setExpandedItem] = React.useState(null);
  const wipRef = React.useRef();
  const stages = Object.entries(kpis.stageCounts).sort((a, b) => b[1] - a[1]);

  useChart(wipRef, {
    type: 'bar',
    data: {
      labels: stages.map(s => s[0]),
      datasets: [{ label: 'Items', data: stages.map(s => s[1]), backgroundColor: stages.map(s => getStageColor(s[0]) + '88'), borderColor: stages.map(s => getStageColor(s[0])), borderWidth: 1, borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } }, y: { ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { display: false } } } }
  }, [kpis]);

  const stageEntries = stages.map(([stage, count]) => ({ stage, count }));
  const maxStageCount = stageEntries.length > 0 ? Math.max(...stageEntries.map(s => s.count)) : 1;

  return (
    <div>
      <div className="section-title">Stage / WIP <span>Analysis</span><div className="section-line"/></div>
      <div className="kpi-grid">
        {stageEntries.map(s => (
          <KPICard
            key={s.stage}
            label={s.stage}
            value={s.count}
            sub={`items in ${s.stage}`}
            color1={getStageColor(s.stage)}
            color2="#7ba7cc"
          />
        ))}
      </div>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Items per Stage (Horizontal)</div>
          <div className="chart-sub">ALL STAGES SORTED BY QUEUE SIZE</div>
          <div className="chart-wrap-lg"><canvas ref={wipRef}/></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Stage Summary</div>
          <div className="chart-sub">INDIVIDUAL STAGES ONLY — NO COMBINED GROUPS</div>
          <div className="vendor-bar-wrap" style={{ marginTop: 8 }}>
            {stageEntries.map(s => (
              <div className="vendor-row" key={s.stage}>
                <div className="vendor-name">{s.stage}</div>
                <div className="vendor-bar-bg">
                  <div className="vendor-bar-fill" style={{ width: `${Math.min(100, (s.count / maxStageCount) * 100)}%`, background: 'linear-gradient(90deg,#00c9ff,#b24bff)' }}/>
                </div>
                <div className="vendor-val">{s.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="table-card">
        <div className="table-header"><div className="chart-title">All Items by Stage — Separate Individual Items</div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SC</th>
                <th>PO</th>
                <th>PRODUCT</th>
                <th>TYPE</th>
                <th>STAGE</th>
                <th>STATUS 1</th>
                <th>INHOUSE</th>
                <th>TIMESTAMP</th>
                <th>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r, i) => (
                <React.Fragment key={i}>
                  <tr style={{ cursor: 'pointer', backgroundColor: expandedItem === i ? 'rgba(0,201,255,0.08)' : 'transparent' }}>
                    <td className="mono text-accent">{r.sc || '—'}</td>
                    <td style={{ fontSize: 11 }}>{r.po}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product || '—'}</td>
                    <td><span className="status-pill badge-blue">{r.type}</span></td>
                    <td><span className="status-pill" style={{ background: getStageColor(r.currentStage) + '22', color: getStageColor(r.currentStage) }}>{r.currentStage}</span></td>
                    <td style={{ fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.status1}</td>
                    <td><span className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}>{r.inhouse}</span></td>
                    <td className="mono" style={{ fontSize: 10 }}>{fmtTs(r.timestamp)}</td>
                    <td>
                      <button onClick={() => setExpandedItem(expandedItem === i ? null : i)} style={{ background: 'none', border: 'none', color: 'var(--accent1)', cursor: 'pointer', fontSize: 11 }}>
                        {expandedItem === i ? '▼' : '▶'}
                      </button>
                    </td>
                  </tr>
                  {expandedItem === i && (
                    <tr style={{ backgroundColor: 'rgba(0,201,255,0.04)', borderBottom: '2px solid var(--border)' }}>
                      <td colSpan="9" style={{ padding: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>PO Number</div>
                            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: 700, color: 'var(--accent1)' }}>{r.po}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>SC Number</div>
                            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: 700, color: 'var(--accent1)' }}>{r.sc || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Current Stage</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: getStageColor(r.currentStage) }}>{r.currentStage}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Days Pending</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: (r.pendingDays || 0) > 2 ? 'var(--danger)' : 'var(--success)' }}>
                              {r.pendingDays != null ? r.pendingDays : '-'}d
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
