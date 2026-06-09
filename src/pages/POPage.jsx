import React from 'react';
import { useData } from '../context/DataContext';
import { useUI } from '../context/UIContext';
import { workingDaysBetween, daysBetween, calculateProcessCycleTime, isSCComplete, getSCLastTimestamp, getProductCategory } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
// ─── PO ANALYSIS PAGE COMPONENT ───────────────────────────────────────────────

function isPOComplete(scGroupsForPO) {
  return scGroupsForPO.length > 0 && scGroupsForPO.every(sg => isSCComplete(sg.items));
}

function POPage() {
  const { kpis, poGroups, scGroups } = useData();
  const { selectedPONum, setSelectedPONum } = useUI();

  const handleSearch = (e) => setSelectedPONum(e.target.value.trim().toUpperCase());
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

  const now = new Date();
  const todayStr =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  // Auto-expand and highlight PO from context state
  React.useEffect(() => {
    if (selectedPONum) {
      const found = poRows.find(p => p.po === selectedPONum);
      if (found) {
        setSelectedPO(found);
        setSelectedPONum(null);
      }
    }
  }, [selectedPONum, poRows, setSelectedPONum]);

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
                <th>SCs COUNT</th>
                <th>ITEMS COUNT</th>
                <th>DELAYED COUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => {
                const delayedItems = p.items.filter(item => (item.pendingDays || 0) > 2);
                const isDelayed = !p.done && (daysBetween(p.poDate, todayStr) > 21 || delayedItems.length > 0);
                const isExpanded = selectedPO?.po === p.po;
                return (
                  <React.Fragment key={i}>
                    <tr 
                      onClick={() => setSelectedPO(isExpanded ? null : p)}
                      style={{ 
                        cursor: 'pointer', 
                        backgroundColor: isExpanded ? 'rgba(0,201,255,0.08)' : isDelayed ? 'rgba(255, 61, 90, 0.08)' : 'transparent',
                        borderLeft: isDelayed ? '3px solid var(--danger)' : 'none'
                      }}
                    >
                      <td className="mono text-accent fw7" style={{ fontSize: 13 }}>{p.po}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{fmtDate(p.poDate)}</td>
                      <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, color: 'var(--text-muted)' }}>{p.scs.length}</td>
                      <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15 }}>{p.items.length}</td>
                      <td>
                        <span style={{ 
                          fontFamily: 'Rajdhani', 
                          fontWeight: 700, 
                          fontSize: 15,
                          color: delayedItems.length > 0 ? 'var(--danger)' : 'var(--success)' 
                        }}>
                          {delayedItems.length}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${p.done ? 's-ready' : 's-wip'}`}>
                          {p.done ? 'COMPLETE' : 'IN PROGRESS'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}>
                        <td colSpan="6" style={{ padding: '12px 16px' }}>
                          <PODetailsExpandable poRow={p} todayStr={todayStr} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PO DETAILS EXPANDABLE COMPONENT ──────────────────────────────────────────────
function PODetailsExpandable({ poRow, todayStr }) {
  const [expandedSCs, setExpandedSCs] = React.useState({});
  
  const toggleSC = (sc) => {
    setExpandedSCs(prev => ({ ...prev, [sc]: !prev[sc] }));
  };

  const scs = poRow.scs;
  const items = poRow.items;
  
  const totalItems = items.length;
  const completedItems = items.filter(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage)).length;
  const delayedItems = items.filter(i => (i.pendingDays || 0) > 2);
  const delayedCount = delayedItems.length;
  const delayedPct = totalItems > 0 ? Math.round((delayedCount / totalItems) * 100) : 0;
  
  return (
    <div style={{ padding: '16px 20px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 8, border: '1px solid rgba(26,58,92,0.4)', marginTop: 4 }}>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <div style={{ background: 'rgba(0,201,255,0.05)', border: '1px solid rgba(0,201,255,0.15)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Total SC Sets</div>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: 'var(--accent1)' }}>{scs.length}</div>
        </div>
        <div style={{ background: 'rgba(0,201,255,0.05)', border: '1px solid rgba(0,201,255,0.15)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Total Items</div>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: 'var(--accent2)' }}>{totalItems}</div>
        </div>
        <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Completed Items</div>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{completedItems}</div>
        </div>
        <div style={{ background: 'rgba(255,61,90,0.05)', border: '1px solid rgba(255,61,90,0.15)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Delayed Items (Delayed %)</div>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: delayedCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {delayedCount} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({delayedPct}%)</span>
          </div>
        </div>
      </div>

      {/* SCs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scs.map((sg) => {
          const isSCExpanded = !!expandedSCs[sg.sc];
          const scItems = items.filter(i => i.sc === sg.sc);
          const scDone = scItems.every(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage));
          return (
            <div key={sg.sc} style={{ border: '1px solid rgba(26,58,92,0.3)', borderRadius: 6, overflow: 'hidden', background: 'rgba(0,0,0,0.12)' }}>
              <div 
                onClick={(e) => { e.stopPropagation(); toggleSC(sg.sc); }}
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(26,58,92,0.3)' }}
              >
                <div>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: 700, color: 'var(--accent1)' }}>SC: {sg.sc}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 12 }}>({scItems.length} items)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`status-pill ${scDone ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 8 }}>
                    {scDone ? '✓ COMPLETE' : '⏳ IN PROGRESS'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isSCExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isSCExpanded && (
                <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.15)' }}>
                  {scItems.map((item, idx) => {
                    const isItemDelayed = (item.pendingDays || 0) > 2;
                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '6px 0', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          borderBottom: idx < scItems.length - 1 ? '1px solid rgba(26,58,92,0.15)' : 'none',
                          color: isItemDelayed ? 'var(--danger)' : 'var(--text-primary)'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{item.product}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>Type: {item.type}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="status-pill" style={{ fontSize: 8, background: getStageColor(item.currentStage) + '22', color: getStageColor(item.currentStage) }}>
                            {item.currentStage}
                          </span>
                          <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, color: isItemDelayed ? 'var(--danger)' : 'var(--success)' }}>
                            {item.pendingDays != null ? `${item.pendingDays}d pending` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default POPage;