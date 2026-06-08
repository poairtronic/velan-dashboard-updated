import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { getStageColor } from '../services/dataNormalizer';
import { workingDaysBetween, daysBetween, calculateProcessCycleTime, isSCComplete, getSCLastTimestamp, getProductCategory } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
// ─── PRODUCTION PAGE COMPONENT ────────────────────────────────────────────────

function ProductionPage() {
  const { kpis, filtered, scGroups } = useDashboard();
  const dailyRef = React.useRef();
  const setsRef  = React.useRef();
  const catRef   = React.useRef();
  const [tab, setTab] = React.useState('sets'); // 'sets' | 'items'

  // Daily items chart
  const byDate = {};
  filtered.forEach(r => {
    if (!r.timestamp) return;
    const d = r.timestamp.substring(0, 10);
    if (!byDate[d]) byDate[d] = { date: d, ready: 0, stores: 0, wip: 0 };
    if (r.currentStage === 'READY') byDate[d].ready++;
    else if (r.currentStage === 'STORES') byDate[d].stores++;
    else byDate[d].wip++;
  });
  const dateSeries = Object.keys(byDate).sort().map(d => byDate[d]);

  useChart(dailyRef, {
    type: 'bar',
    data: {
      labels: dateSeries.map(d => d.date.substring(5)),
      datasets: [
        { label: 'Ready Items', data: dateSeries.map(d => d.ready), backgroundColor: '#00e67699', borderColor: '#00e676', borderWidth: 1, borderRadius: 3 },
        { label: 'To Stores',  data: dateSeries.map(d => d.stores), backgroundColor: '#00c9ff99', borderColor: '#00c9ff', borderWidth: 1, borderRadius: 3 },
        { label: 'WIP',        data: dateSeries.map(d => d.wip), backgroundColor: '#ffd60a44', borderColor: '#ffd60a', borderWidth: 1, borderRadius: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { stacked: true, ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } }
      },
      plugins: { legend: { labels: { color: '#7ba7cc' } } }
    }
  }, [filtered]);

  // SC Sets daily output chart
  const scDaily = kpis.scDailyOutput;
  useChart(setsRef, {
    type: 'bar',
    data: {
      labels: scDaily.map(d => d.date.substring(5)),
      datasets: [
        { label: 'Sets → READY',  data: scDaily.map(d => d.readySets), backgroundColor: '#00e67699', borderColor: '#00e676', borderWidth: 1, borderRadius: 4 },
        { label: 'Sets → STORES', data: scDaily.map(d => d.storeSets), backgroundColor: '#00c9ff99', borderColor: '#00c9ff', borderWidth: 1, borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { stacked: true, ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' }, title: { display: true, text: 'SC Sets', color: '#7ba7cc' } }
      },
      plugins: { legend: { labels: { color: '#7ba7cc' } } }
    }
  }, [kpis]);

  const cats = { AIRPLUG: 0, MASTER: 0, ACCESSORY: 0 };
  filtered.forEach(r => { cats[getProductCategory(r.type)]++; });
  useChart(catRef, {
    type: 'doughnut',
    data: {
      labels: Object.keys(cats),
      datasets: [{ data: Object.values(cats), backgroundColor: ['#00c9ff88', '#00ff9d88', '#ffd60a88'], borderColor: ['#00c9ff', '#00ff9d', '#ffd60a'], borderWidth: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#7ba7cc', font: { size: 11 } } } } }
  }, [filtered]);

  const readySets   = kpis.readySets;
  const storeSets   = kpis.storeSets;
  const displaySets = tab === 'sets' ? (readySets.concat(storeSets)) : null;
  const readyItems  = filtered.filter(r => r.currentStage === 'READY');

  return (
    <div>
      <div className="section-title">Production <span>Output</span><div className="section-line"/></div>
      <div className="kpi-grid">
        <KPICard label="COMPLETE SC SETS" value={readySets.length} sub="full sets ready to dispatch" color1="#00e676" color2="#00c9ff" badge={{ text: 'READY', cls: 'badge-green' }}/>
        <KPICard label="SETS → STORES" value={storeSets.length} sub="full sets moved to stores" color1="#00c9ff" color2="#0fa8e0" badge={{ text: 'STORES', cls: 'badge-blue' }}/>
        <KPICard label="READY ITEMS" value={kpis.ready} sub="individual items ready" color1="#00e676" color2="#0fa8e0"/>
        <KPICard label="ITEMS → STORES" value={kpis.stores} sub="individual items in stores" color1="#00c9ff" color2="#0fa8e0"/>
        <KPICard label="AIRPLUG OUTPUT" value={filtered.filter(r => AIRPLUG_TYPES.includes(r.type) && ['READY', 'STORES'].includes(r.currentStage)).length} sub="APG/ARG items done" color1="#00c9ff" color2="#b24bff"/>
        <KPICard label="MASTER OUTPUT" value={filtered.filter(r => ['SPG', 'SRG', 'SP'].includes(r.type) && ['READY', 'STORES'].includes(r.currentStage)).length} sub="SRG/SP items done" color1="#00ff9d" color2="#00c9ff"/>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">📦 Daily SC Sets Output (Grouped)</div>
          <div className="chart-sub">COMPLETE SETS REACHING READY / STORES EACH DAY</div>
          <div className="chart-wrap-lg"><canvas ref={setsRef}/></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">📊 Daily Items Output</div>
          <div className="chart-sub">INDIVIDUAL ITEMS BY STATUS PER DATE</div>
          <div className="chart-wrap-lg"><canvas ref={dailyRef}/></div>
        </div>
      </div>

      <div className="chart-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="chart-card">
          <div className="chart-title">Product Mix</div>
          <div className="chart-sub">AIRPLUG / MASTER / ACCESSORY</div>
          <div className="chart-wrap"><canvas ref={catRef}/></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">SC Sets Daily — Detail</div>
          <div className="chart-sub">SETS COMPLETED PER DAY</div>
          <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>DATE</th>
                  <th style={{ padding: '8px 10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>READY SETS</th>
                  <th style={{ padding: '8px 10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>STORE SETS</th>
                  <th style={{ padding: '8px 10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {scDaily.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,92,0.4)' }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--accent1)' }}>{d.date}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--success)', fontWeight: 700 }}>{d.readySets || 0}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--accent1)', fontWeight: 700 }}>{d.storeSets || 0}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'Rajdhani', fontSize: 16 }}>{(d.readySets || 0) + (d.storeSets || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="tabs">
        {[['sets', 'SC Sets (Complete)'], ['items', 'Ready Items']].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>
      
      {tab === 'sets' && (
        <div className="table-card">
          <div className="table-header"><div className="chart-title">✅ Complete SC Sets ({displaySets.length}) — Ready + Stores</div></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SC NO</th>
                  <th>PO</th>
                  <th>PRODUCTS IN SET</th>
                  <th>LAST TIMESTAMP</th>
                  <th>DAYS</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {displaySets.map((sg, i) => {
                  const hasStore = sg.items.some(i => i.currentStage === 'STORES');
                  const lastTs = getSCLastTimestamp(sg.items);
                  const days = daysBetween(sg.poDate, lastTs);
                  return (
                    <tr key={i}>
                      <td className="mono text-accent fw7">{sg.sc}</td>
                      <td style={{ fontSize: 11 }}>{sg.po}</td>
                      <td style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.items.map(item => item.product).join(' · ')}</td>
                      <td className="mono" style={{ fontSize: 10 }}>{fmtDate(lastTs)}</td>
                      <td><span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 17, color: (days || 0) > 21 ? 'var(--danger)' : 'var(--success)' }}>{days ?? '—'}</span></td>
                      <td><span className={`status-pill ${hasStore ? 's-stores' : 's-ready'}`}>{hasStore ? 'STORES' : 'READY'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {tab === 'items' && (
        <div className="table-card">
          <div className="table-header"><div className="chart-title">✅ Ready Items ({readyItems.length})</div></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SC</th>
                  <th>PO</th>
                  <th>PRODUCT</th>
                  <th>TYPE</th>
                  <th>CATEGORY</th>
                  <th>INHOUSE</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {readyItems.slice(0, 150).map((r, i) => (
                  <tr key={i}>
                    <td className="mono text-accent">{r.sc || '—'}</td>
                    <td>{r.po}</td>
                    <td>{r.product || '—'}</td>
                    <td><span className="status-pill badge-blue">{r.type || '—'}</span></td>
                    <td><span className="status-pill badge-green">{getProductCategory(r.type)}</span></td>
                    <td>{r.inhouse}</td>
                    <td className="mono" style={{ fontSize: 10 }}>{fmtTs(r.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionPage;