// ─── PO ANALYSIS PAGE COMPONENT ───────────────────────────────────────────────

function isPOComplete(scGroupsForPO) {
  return scGroupsForPO.length > 0 && scGroupsForPO.every(sg => isSCComplete(sg.items));
}

function POPage() {
  const { kpis, poGroups, scGroups } = useDashboard();
  const leadsRef = React.useRef();
  const [tab, setTab]           = React.useState('all');
  const [selectedPO, setSelectedPO] = React.useState(null);
  const [search, setSearch]     = React.useState('');

  // Build PO → SC mapping from scGroups
  const poSCMap = {};
  scGroups.forEach(sg => {
    if (!poSCMap[sg.po]) poSCMap[sg.po] = [];
    poSCMap[sg.po].push(sg);
  });

  // Build enriched PO rows
  const poRows = poGroups.map(pg => {
    const scs    = poSCMap[pg.po] || [];
    const done   = isPOComplete(scs);
    const lastTs = getSCLastTimestamp(pg.items);
    const days   = daysBetween(pg.poDate, lastTs);
    return { ...pg, scs, done, lastTs, days };
  });

  const tabFiltered = tab === 'complete' ? poRows.filter(p => p.done)
                    : tab === 'wip'      ? poRows.filter(p => !p.done)
                    : poRows;

  const displayed = search.trim()
    ? tabFiltered.filter(p => {
        const s = search.trim().toLowerCase();
        return String(p.po || '').toLowerCase().includes(s) ||
               p.scs.some(sg => String(sg.sc || '').toLowerCase().includes(s)) ||
               p.items.some(item => String(item.product || '').toLowerCase().includes(s));
      })
    : tabFiltered;

  const completePOs   = poRows.filter(p => p.done).length;
  const inProgressPOs = poRows.filter(p => !p.done).length;

  const leadData = kpis.bottleneck.slice(0, 15);
  useChart(leadsRef, {
    type: 'bar',
    data: {
      labels: leadData.map(b => b.po.length > 12 ? b.po.substring(0, 12) + '…' : b.po),
      datasets: [{
        label: 'Days',
        data: leadData.map(b => b.days || 0),
        backgroundColor: leadData.map(b => (b.days || 0) > 21 ? '#ff3d5a99' : '#00e67699'),
        borderColor: leadData.map(b => (b.days || 0) > 21 ? '#ff3d5a' : '#00e676'),
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.y} days` } } },
      scales: {
        x: { ticks: { color: '#7ba7cc', font: { size: 9 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' }, title: { display: true, text: 'Days', color: '#7ba7cc' } }
      }
    }
  }, [kpis]);

  return (
    <div>
      <div className="section-title">PO <span>Analysis</span><div className="section-line"/></div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard label="TOTAL POs" value={poGroups.length} sub="purchase orders" color1="#00c9ff" color2="#0fa8e0"/>
        <KPICard label="COMPLETE POs" value={completePOs} sub="all SC sets ready" color1="#00e676" color2="#00c9ff"/>
        <KPICard label="IN-PROGRESS POs" value={inProgressPOs} sub="awaiting completion" color1="#ffd60a" color2="#ff6b35"/>
        <KPICard label="TARGET" value="21 days" sub="3 weeks delivery target" color1="#ffd60a" color2="#ff6b35"/>
      </div>

      {/* Lead Time Chart */}
      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div className="chart-title">Lead Time per PO — Bottleneck Chart</div>
        <div className="chart-sub">RED = EXCEEDED 21 DAYS · GREEN = ON TIME</div>
        <div className="chart-wrap-lg"><canvas ref={leadsRef}/></div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {[['all', 'All POs'], ['complete', 'Completed'], ['wip', 'In Progress']].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => { setTab(id); setSelectedPO(null); }}>
            {label}
          </div>
        ))}
      </div>

      {/* PO Sets Table */}
      <div className="table-card">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="chart-title">PO Sets — {displayed.length} entries</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input
              className="filter-input"
              placeholder="Search PO / SC / Product..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedPO(null); }}
              style={{ minWidth: 220, padding: '5px 12px' }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSelectedPO(null); }}
                className="filter-btn reset"
                style={{ padding: '5px 10px' }}
              >✕ Clear</button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO</th>
                <th>PO DATE</th>
                <th>SC SETS</th>
                <th>ITEMS</th>
                <th>LAST TIMESTAMP</th>
                <th>DAYS TAKEN</th>
                <th>VS TARGET</th>
                <th>PO STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => {
                const over = (p.days || 0) - 21;
                return (
                  <tr key={i}>
                    <td>
                      <button
                        onClick={() => setSelectedPO(selectedPO?.po === p.po ? null : p)}
                        className="mono text-accent fw7"
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          textDecoration: 'underline', fontSize: 13
                        }}
                        title={`View SC sets for PO ${p.po}`}
                      >
                        {p.po}
                      </button>
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>{fmtDate(p.poDate)}</td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, color: 'var(--text-muted)' }}>{p.scs.length}</td>
                    <td>{p.items.length}</td>
                    <td className="mono" style={{ fontSize: 10 }}>{fmtDate(p.lastTs)}</td>
                    <td>
                      <span style={{
                        fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18,
                        color: p.done && p.days != null && p.days > 21 ? 'var(--danger)' :
                              p.done ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {p.days ?? '—'}
                      </span>
                    </td>
                    <td style={{ color: over > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                      {p.days != null ? (over > 0 ? `+${over} over` : `-${Math.abs(over)} early`) : '—'}
                    </td>
                    <td>
                      <span className={`status-pill ${p.done ? 's-ready' : 's-wip'}`}>
                        {p.done ? 'COMPLETE' : 'IN PROGRESS'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down sets list */}
      {selectedPO && (
        <div className="table-card" style={{ marginTop: 16 }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="chart-title">PO {selectedPO.po} — SC Sets Inside</div>
              <div className="chart-sub">
                {selectedPO.scs.length} SC sets · {selectedPO.items.length} total items
              </div>
            </div>
            <button
              onClick={() => setSelectedPO(null)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}
            >CLOSE</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SC NO</th>
                  <th>ITEMS</th>
                  <th>LAST TIMESTAMP</th>
                  <th>DAYS TAKEN</th>
                  <th>SET STATUS</th>
                </tr>
              </thead>
              <tbody>
                {selectedPO.scs.map((sg, idx) => {
                  const scDone  = isSCComplete(sg.items);
                  const scLastTs = getSCLastTimestamp(sg.items);
                  const scDays  = daysBetween(selectedPO.poDate, scLastTs);
                  return (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td className="mono text-accent fw7">{sg.sc}</td>
                      <td>{sg.items.length}</td>
                      <td className="mono" style={{ fontSize: 10 }}>{fmtDate(scLastTs)}</td>
                      <td>
                        <span style={{
                          fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18,
                          color: scDone && scDays != null && scDays > 21 ? 'var(--danger)' :
                                scDone ? 'var(--success)' : 'var(--warning)'
                        }}>
                          {scDays ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${scDone ? 's-ready' : 's-wip'}`}>
                          {scDone ? 'COMPLETE' : 'IN PROGRESS'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
