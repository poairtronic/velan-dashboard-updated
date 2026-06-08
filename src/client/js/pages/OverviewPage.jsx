import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { getStageColor } from '../services/dataNormalizer';
import { workingDaysBetween, daysBetween, calculateProcessCycleTime, isSCComplete, getSCLastTimestamp, getProductCategory } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
import ErrorBoundary from '../components/ErrorBoundary';
// ─── OVERVIEW PAGE COMPONENT ──────────────────────────────────────────────────

function OverviewPage() {
  const { kpis, filtered, liveData, data } = useDashboard();
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const [showReadyDetails, setShowReadyDetails] = React.useState(false);
  const [openPOIds, setOpenPOIds] = React.useState({});
  const stageChartRef = React.useRef();
  const donutRef = React.useRef();
  const typeChartRef = React.useRef();

  const now = new Date();
  const todayStr =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  // 1. Daily Set: POs where all SCs are completed (READY/STORES/STOCK) and completed today
  const poGroupsLive = {};
  liveData.forEach(item => {
    if (!item.po) return;
    if (!poGroupsLive[item.po]) poGroupsLive[item.po] = [];
    poGroupsLive[item.po].push(item);
  });
  const dailySetPOs = Object.entries(poGroupsLive).filter(([po, items]) => {
    // All SCs completed
    const allDone = items.every(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage));
    // Completed today (last updated today)
    const completedToday = items.some(i => i.timestamp && i.timestamp.slice(0, 10) === todayStr);
    return allDone && completedToday;
  });
  const dailySetItems = dailySetPOs.flatMap(([_, items]) => items);

  // 2. Delayed PO: not completed AND poDate > 21 working days ago
  const delayedPOItems = liveData.filter(i => {
    if (['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage)) return false;
    if (!i.poDate) return false;
    const days = workingDaysBetween(i.poDate, todayStr);
    return days !== null && days > 21;
  });

  // 3. In Progress: not completed AND within 21 working days from PO date
  const inProgressItems = liveData.filter(i => {
    if (['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage)) return false;
    const days = i.poDate ? workingDaysBetween(i.poDate, todayStr) : null;
    return days === null || days <= 21;
  });

  // Group items by PO for modal display
  function groupByPO(items) {
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.po]) grouped[item.po] = [];
      grouped[item.po].push(item);
    });
    return Object.entries(grouped).map(([po, poItems]) => ({
      po,
      scs: [...new Set(poItems.map(i => i.sc))],
      items: poItems,
      count: poItems.length
    }));
  }

  const dailyPOs = groupByPO(dailySetItems);
  const delayedPOs = groupByPO(delayedPOItems);
  const inProgressPOs = groupByPO(inProgressItems);

  // Define readyPOs so the "View ready details" modal works
  const readyItems = liveData.filter(i => i.currentStage === 'READY');
  const readyPOs = groupByPO(readyItems);

  const stages = Object.entries(kpis.stageCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  useChart(stageChartRef, {
    type: 'bar',
    data: {
      labels: stages.map(s => s[0]),
      datasets: [{
        label: 'Items',
        data: stages.map(s => s[1]),
        backgroundColor: stages.map(s => getStageColor(s[0]) + '99'),
        borderColor: stages.map(s => getStageColor(s[0])),
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } }
      }
    }
  }, [kpis]);

  const inhouseCount = filtered.filter(r => r.inhouse === 'INHOUSE').length;
  const vendorCount = filtered.filter(r => r.inhouse === 'VENDOR').length;
  useChart(donutRef, {
    type: 'doughnut',
    data: {
      labels: ['Inhouse', 'Vendor'],
      datasets: [{ data: [inhouseCount, vendorCount], backgroundColor: ['#00c9ff99', '#b24bff99'], borderColor: ['#00c9ff', '#b24bff'], borderWidth: 2, hoverOffset: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#7ba7cc', font: { size: 11 } } } } }
  }, [kpis, filtered]);

  const typeCounts = {};
  filtered.forEach(r => { typeCounts[getProductCategory(r.type)] = (typeCounts[getProductCategory(r.type)] || 0) + 1; });
  useChart(typeChartRef, {
    type: 'pie',
    data: {
      labels: Object.keys(typeCounts),
      datasets: [{ data: Object.values(typeCounts), backgroundColor: ['#00c9ff99', '#00ff9d99', '#ffd60a99'], borderColor: ['#00c9ff', '#00ff9d', '#ffd60a'], borderWidth: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#7ba7cc', font: { size: 11 } } } } }
  }, [filtered]);

  return (
    <div>
      <div className="section-title">Overview <span>Dashboard</span><div className="section-line"/></div>

      <div className="kpi-grid">
        <KPICard label="TOTAL ITEMS" value={filtered.length} sub="in current view" color1="#00c9ff" color2="#0fa8e0"/>
        <KPICard
          label="READY / DAILY OUT"
          value={kpis.ready}
          sub="sets ready to dispatch"
          color1="#00e676"
          color2="#00c9ff"
          badge={{ text: `+${kpis.stores} to stores`, cls: 'badge-blue' }}
          action={{ text: 'View ready details', onClick: () => setShowReadyDetails(true) }}
        />
        <KPICard label="IN PROGRESS (WIP)" value={kpis.wip} sub="items active in production" color1="#ffd60a" color2="#ff6b35"/>
        <KPICard label="ON-TIME COMPLETION" value={`${kpis.onTimePct}%`} sub={`${kpis.onTime} of ${kpis.totalPOs} POs within 3 weeks`} color1="#00ff9d" color2="#00c9ff" badge={{ text: `${kpis.delayed} delayed`, cls: 'badge-red' }}/>
        <KPICard label="DELAYED POs" value={kpis.delayed} sub="exceeded 21-day target" color1="#ff3d5a" color2="#ff6b35"/>
        <KPICard label="INHOUSE WORKLOAD" value={`${Math.round(kpis.inhouse / Math.max(filtered.length, 1) * 100)}%`} sub={`${kpis.inhouse} inhouse · ${kpis.vendor} vendor`} color1="#00c9ff" color2="#b24bff"/>
      </div>

      {/* Category Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { id: 'daily', label: 'DAILY SET', value: dailySetItems.length, sub: 'items created today', color1: '#00c9ff', color2: '#0fa8e0', data: dailyPOs },
          { id: 'delayed', label: 'DELAYED SC', value: delayedPOItems.length, sub: 'items in delayed POs', color1: '#ff3d5a', color2: '#ff6b35', data: delayedPOs },
          { id: 'inprogress', label: 'INPROGRESS', value: inProgressItems.length, sub: 'items in production', color1: '#ffd60a', color2: '#b24bff', data: inProgressPOs },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(cat.id); setOpenPOIds({}); }}
            style={{
              background: `linear-gradient(135deg,${cat.color1}15,${cat.color2}08)`,
              border: `1px solid ${cat.color1}40`,
              borderRadius: 10,
              padding: 16,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = cat.color1 + '80';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = cat.color1 + '40';
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>{cat.label}</div>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 32, fontWeight: 700, color: cat.color1, marginBottom: 6 }}>{cat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cat.sub}</div>
            <div style={{ fontSize: 10, color: cat.color1, marginTop: 8 }}>CLICK TO VIEW ▸</div>
          </button>
        ))}
      </div>

      {/* Category Modal */}
      {selectedCategory && (
        <Modal
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          title={selectedCategory === 'daily' ? '📅 DAILY SET' : selectedCategory === 'delayed' ? '⚠️ DELAYED POs' : '⏳ INPROGRESS'}
          width={750}
        >
          <OverviewStatsModal
            category={selectedCategory}
            data={selectedCategory === 'daily' ? dailyPOs : selectedCategory === 'delayed' ? delayedPOs : inProgressPOs}
            todayStr={todayStr}
          />
        </Modal>
      )}

      {showReadyDetails && (
        <div className="table-card" style={{ marginBottom: 20, border: '2px solid var(--success)', boxShadow: '0 0 30px rgba(0,230,118,0.2)' }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,230,118,0.06)' }}>
            <div>
              <div className="chart-title" style={{ color: 'var(--success)' }}>
                ✅ READY / DAILY OUT DETAILS
              </div>
              <div className="chart-sub">
                PO and SC numbers ready to dispatch with item details
              </div>
            </div>
            <button
              onClick={() => setShowReadyDetails(false)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
            >
              CLOSE
            </button>
          </div>
          <div style={{ padding: '16px 18px', maxHeight: '500px', overflowY: 'auto' }}>
            {readyPOs.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No ready items found for dispatch.</div>
            ) : readyPOs.map((poGroup, poIdx) => (
              <div key={poIdx} style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'rgba(0,230,118,0.08)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>{poGroup.po}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>SCs: {poGroup.scs.join(', ')}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{poGroup.count} ready items</div>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)' }}>
                  {poGroup.items.map((item, idx) => (
                    <div key={idx} style={{ padding: '8px 0', borderBottom: idx < poGroup.items.length - 1 ? '1px solid rgba(26,58,92,0.4)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--accent1)' }}>{item.sc}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-primary)' }}>{item.product}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Stage: <strong>{item.currentStage}</strong></span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last update: {fmtTs(item.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Stage-Wise Item Distribution</div>
          <div className="chart-sub">ITEMS PER PRODUCTION STAGE</div>
          <div className="chart-wrap"><canvas ref={stageChartRef}/></div>
        </div>
        <div className="chart-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div className="chart-title">Inhouse vs Vendor</div>
            <div className="chart-sub">WORKLOAD SPLIT</div>
            <div className="chart-wrap"><canvas ref={donutRef}/></div>
          </div>
          <div>
            <div className="chart-title">Product Category</div>
            <div className="chart-sub">AIRPLUG / MASTER / ACC</div>
            <div className="chart-wrap"><canvas ref={typeChartRef}/></div>
          </div>
        </div>
      </div>

      {/* Bottleneck quick view */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">⚠ Bottleneck POs (Highest Lead Time)</div>
        <div className="chart-sub">ORDERED BY DAYS — TARGET: 21 DAYS</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {kpis.bottleneck.filter(b => !b.done).slice(0, 10).map(b => (
            <div key={b.po} style={{ background: 'var(--bg-secondary)', border: `1px solid ${(b.days || 0) > 21 ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 14px', minWidth: 140 }}>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-muted)' }}>{b.po}</div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, color: (b.days || 0) > 21 ? 'var(--danger)' : 'var(--success)' }}>{b.days ?? '—'}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}> days</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>⏳ In progress</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW STATS MODAL COMPONENT ──────────────────────────────────────────────
function OverviewStatsModal({ category, data, todayStr }) {
  const [expandedPOs, setExpandedPOs] = React.useState({});
  const [expandedSCs, setExpandedSCs] = React.useState({});

  const togglePO = (po) => {
    setExpandedPOs(prev => ({ ...prev, [po]: !prev[po] }));
  };

  const toggleSC = (sc) => {
    setExpandedSCs(prev => ({ ...prev, [sc]: !prev[sc] }));
  };

  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No items found for this category.</div>;
  }

  return (
    <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
      {data.map((poGroup, poIdx) => {
        const isPOExpanded = !!expandedPOs[poGroup.po];
        return (
          <div key={poGroup.po} style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(26,58,92,0.15)', overflow: 'hidden' }}>
            {/* PO Header */}
            <div 
              onClick={() => togglePO(poGroup.po)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: isPOExpanded ? 'rgba(0, 201, 255, 0.08)' : 'transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <div>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: 700, color: 'var(--accent1)' }}>{poGroup.po}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 12 }}>
                  {poGroup.count} items · {poGroup.scs.length} SCs
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isPOExpanded ? '▲' : '▼'}</div>
            </div>

            {/* PO Expand Content (SCs List) */}
            {isPOExpanded && (
              <div style={{ padding: '8px 16px 16px 16px', borderTop: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.2)' }}>
                {poGroup.scs.map((scNum) => {
                  const isSCExpanded = !!expandedSCs[scNum];
                  const scItems = poGroup.items.filter(item => item.sc === scNum);
                  return (
                    <div key={scNum} style={{ marginTop: 8, border: '1px solid rgba(26,58,92,0.3)', borderRadius: 6, background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                      {/* SC Header */}
                      <div
                        onClick={() => toggleSC(scNum)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isSCExpanded ? 'rgba(0, 201, 255, 0.04)' : 'transparent'
                        }}
                      >
                        <div>
                          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: 600, color: 'var(--accent2)' }}>{scNum || '—'}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 10 }}>({scItems.length} items)</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isSCExpanded ? '▲' : '▼'}</div>
                      </div>

                      {/* SC Expand Content (Items List) */}
                      {isSCExpanded && (
                        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(26,58,92,0.2)', background: 'rgba(0,0,0,0.1)' }}>
                          {scItems.map((item, itemIdx) => {
                            const poAge = item.poDate ? workingDaysBetween(item.poDate, todayStr) : null;
                            const isDelayed = poAge !== null && poAge > 21;
                            return (
                              <div 
                                key={itemIdx} 
                                style={{ 
                                  padding: '6px 0', 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  borderBottom: itemIdx < scItems.length - 1 ? '1px solid rgba(26,58,92,0.2)' : 'none'
                                }}
                              >
                                <div style={{ flex: 1, paddingRight: 10 }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{item.product}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Type: <span style={{ color: 'var(--accent1)' }}>{item.type}</span> · Stage: <strong style={{ color: getStageColor(item.currentStage) }}>{item.currentStage}</strong> · {item.inhouse}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  {poAge != null ? (
                                    <span style={{
                                      fontFamily: 'Rajdhani',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      color: isDelayed ? 'var(--danger)' : poAge > 14 ? 'var(--warning)' : 'var(--success)',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: isDelayed ? 'rgba(255, 61, 90, 0.1)' : poAge > 14 ? 'rgba(255, 214, 10, 0.1)' : 'rgba(0, 230, 118, 0.1)'
                                    }}>
                                      {poAge}d aging
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>
                                  )}
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
            )}
          </div>
        );
      })}
    </div>
  );
}

export default OverviewPage;