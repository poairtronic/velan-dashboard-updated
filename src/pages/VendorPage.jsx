import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { getStageColor } from '../services/dataNormalizer';
import { workingDaysBetween, daysBetween, calculateProcessCycleTime, isSCComplete, getSCLastTimestamp, getProductCategory, TARGET_DAYS } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
// ─── VENDOR EVALUATION PAGE COMPONENT ─────────────────────────────────────────

function VendorPage() {
  const { kpis, data, setActiveNav, setSelectedPONum } = useDashboard();
  const [selectedSC, setSelectedSC] = React.useState(null);
  const [selectedItem, setSelectedItem] = React.useState(null);
  const vendorBarRef  = React.useRef();
  const vendorTimeRef = React.useRef();
  const vendors = kpis.vendors;
  const max = vendors.length > 0 ? Math.max(...vendors.map(v => v.count)) : 1;
  const maxDays = vendors.length > 0 ? Math.max(...vendors.map(v => v.avgDays || 0)) : 1;

  useChart(vendorBarRef, {
    type: 'bar',
    data: {
      labels: vendors.map(v => v.code),
      datasets: [
        { label: 'Avg Pending Days (Today - Last Update)', data: vendors.map(v => v.avgDays || 0), backgroundColor: vendors.map(v => (v.avgDays || 0) > 21 ? '#ff3d5a99' : '#ffd60a99'), borderColor: vendors.map(v => (v.avgDays || 0) > 21 ? '#ff3d5a' : '#ffd60a'), borderWidth: 1, borderRadius: 4 },
        { label: 'Max Pending Days', data: vendors.map(v => v.maxDays || 0), backgroundColor: 'rgba(255,107,53,0.3)', borderColor: '#ff6b35', borderWidth: 1, borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#7ba7cc' } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} days` } } },
      scales: {
        x: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } },
        y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' }, title: { display: true, text: 'Pending Days (Today - Last Update)', color: '#7ba7cc' } }
      }
    }
  }, [kpis]);

  const inhPct = Math.round(kpis.inhouse / Math.max(kpis.inhouse + kpis.vendor, 1) * 100);
  const venPct = 100 - inhPct;
  const worstVendor = vendors.reduce((a, b) => (b.avgDays || 0) > (a.avgDays || 0) ? b : a, vendors[0] || {});
  const mostDelayed = vendors.reduce((a, b) => (b.delayed || 0) > (a.delayed || 0) ? b : a, vendors[0] || {});
  const now = new Date();
  const todayRef =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  return (
    <div>
      <div className="section-title">🏭 Vendor <span>Evaluation</span><div className="section-line"/></div>

      <div className="kpi-grid">
        <KPICard label="INHOUSE ITEMS" value={kpis.inhouse} sub={`${inhPct}% of total`} color1="#00c9ff" color2="#0fa8e0"/>
        <KPICard label="VENDOR ITEMS" value={kpis.vendor} sub={`${venPct}% of total`} color1="#b24bff" color2="#ff6b35"/>
        <KPICard label="VENDOR STAGES" value={vendors.length} sub="distinct vendor operations" color1="#ffd60a" color2="#b24bff"/>
        <KPICard label="SLOWEST VENDOR OP" value={worstVendor?.code || '—'} sub={`~${worstVendor?.avgDays || 0} days since last update`} color1="#ff3d5a" color2="#ff6b35" badge={{ text: 'HIGHEST AGING', cls: 'badge-red' }}/>
        <KPICard label="MOST DELAYED" value={mostDelayed?.code || '—'} sub={`${mostDelayed?.delayed || 0} items >21 days pending`} color1="#ff3d5a" color2="#b24bff" badge={{ text: 'DELAYED', cls: 'badge-red' }}/>
        <KPICard label="TOTAL VENDOR" value={kpis.inhouse + kpis.vendor} sub="all items tracked" color1="#00ff9d" color2="#00c9ff"/>
      </div>
      <div style={{ marginTop: -8, marginBottom: 14, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono,monospace' }}>
        Aging reference date: {todayRef} (computed from last edit/update timestamp in sheet)
      </div>

      {/* Inhouse vs Vendor split bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div className="chart-title">Inhouse vs Vendor Workload Split</div>
        <div className="chart-sub">PERCENTAGE OF TOTAL ITEMS</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${inhPct}%`, background: 'linear-gradient(90deg,#00c9ff,#0fa8e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#000' }}>{inhPct}% IH</div>
              <div style={{ width: `${venPct}%`, background: 'linear-gradient(90deg,#b24bff,#ff6b35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{venPct}% VN</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--accent1)' }}>■ Inhouse: {kpis.inhouse}</span>
            <span style={{ fontSize: 12, color: 'var(--accent6)' }}>■ Vendor: {kpis.vendor}</span>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Items per Vendor Operation</div>
          <div className="chart-sub">WORKLOAD BY VENDOR STAGE CODE</div>
          <div className="chart-wrap"><canvas ref={vendorBarRef}/></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">⏱ Avg & Max Pending Days per Vendor Op</div>
          <div className="chart-sub">TODAY - LAST UPDATE TIMESTAMP · RED = OVER 21 DAYS</div>
          <div className="chart-wrap"><canvas ref={vendorTimeRef}/></div>
        </div>
      </div>

      {/* Vendor time ranking bars */}
      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div className="chart-title">Vendor Operation — Time Ranking</div>
        <div className="chart-sub">SORTED BY AVG PENDING DAYS (HIGHEST = NEEDS ATTENTION)</div>
        <div className="vendor-bar-wrap" style={{ marginTop: 12 }}>
          {[...vendors].sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0)).map((v, i) => {
            const pct = Math.min(100, Math.round((v.avgDays || 0) / Math.max(maxDays, 1) * 100));
            const overdue = (v.avgDays || 0) > TARGET_DAYS;
            return (
              <div className="vendor-row" key={i}>
                <div className="vendor-name" style={{ color: overdue ? 'var(--danger)' : 'var(--text-secondary)' }}>{v.code}</div>
                <div className="vendor-bar-bg">
                  <div className="vendor-bar-fill" style={{ width: `${pct}%`, background: overdue ? 'linear-gradient(90deg,#ff3d5a,#ff6b35)' : 'linear-gradient(90deg,#ffd60a,#b24bff)' }}/>
                </div>
                <div style={{ width: 110, textAlign: 'right', fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {v.avgDays != null ? `${v.avgDays}d avg pending` : '-'} · {v.count} items
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Cycle Time & Efficiency Metrics */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div className="chart-title">⏱ Process Cycle Time & Efficiency by Vendor Operation</div>
        <div className="chart-sub">AVERAGE TIME FROM PO RECEIPT · PROCESS COMPLETION RATE · SLA VIOLATIONS (2d+ PENDING)</div>
        <div className="vendor-bar-wrap" style={{ marginTop: 12 }}>
          {[...vendors].sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0)).map((v, i) => {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(26,58,92,0.4)' }}>
                <div style={{ width: 90, fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--accent1)', fontWeight: 700 }}>{v.code}</div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Pending Days</div>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: 'var(--accent4)' }}>{v.avgDays != null ? `${v.avgDays}d` : '—'}</div>
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Completion Rate</div>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{v.processEfficiency != null ? `${v.processEfficiency}%` : '—'}</div>
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>SLA Violations (2d+)</div>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: v.slaViolations > 0 ? 'var(--danger)' : 'var(--success)' }}>{v.slaViolations || 0}</div>
                </div>
                <div style={{ flex: 0.25 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Violation Rate</div>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: v.slaViolationRate > 20 ? 'var(--danger)' : v.slaViolationRate > 10 ? 'var(--warning)' : 'var(--success)' }}>{v.slaViolationRate != null ? `${v.slaViolationRate}%` : '—'}</div>
                </div>
                <div style={{ flex: 0.2 }}>
                  <span className={`status-pill ${v.slaViolations === 0 ? 'badge-green' : v.slaViolationRate > 20 ? 'badge-red' : 'badge-yellow'}`}>
                    {v.slaViolations === 0 ? '✓ COMPLIANT' : v.slaViolationRate > 20 ? '⚠ CRITICAL' : '⚡ WARNING'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottleneck Detection */}
      {kpis.topVendorBottleneck && (
        <div style={{ background: 'linear-gradient(135deg,rgba(255,61,90,0.1),rgba(255,107,53,0.08))', border: '1px solid rgba(255,61,90,0.3)', borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div className="chart-title" style={{ color: 'var(--danger)' }}>⚠️ Vendor Bottleneck Alert</div>
          <div className="chart-sub">HIGHEST RISK VENDOR OPERATION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Bottleneck Operation</div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{kpis.topVendorBottleneck.vendor}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Avg Pending Days</div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: 'var(--accent4)' }}>{kpis.topVendorBottleneck.avgPending}d</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>SLA Violations</div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{kpis.topVendorBottleneck.slaViolations}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Process Efficiency</div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{kpis.topVendorBottleneck.efficiency}%</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            This vendor operation has the highest bottleneck score and requires immediate attention. Consider process optimization or resource reallocation.
          </div>
        </div>
      )}

      {/* Full vendor detail table */}
      <div className="table-card">
        <div className="table-header"><div className="chart-title">Full Vendor Evaluation Table</div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>VENDOR OP</th><th>ITEMS</th><th>% SHARE</th>
                <th>AVG PENDING DAYS</th><th>MAX PENDING</th><th>DELAYED (&gt;21d)</th>
                <th>PROCESS CYCLE</th><th>EFFICIENCY</th><th>SLA VIOLATIONS</th>
                <th>LAST UPDATE</th><th>RATING</th><th>SAMPLE PRODUCTS</th>
              </tr>
            </thead>
            <tbody>
              {[...vendors].sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0)).map((v, i) => {
                const overdue = (v.avgDays || 0) > TARGET_DAYS;
                const latestTs = v.items.map(it => it.timestamp).filter(Boolean).sort().pop();
                const rating = overdue ? '🔴 SLOW' : (v.avgDays || 0) > 14 ? '🟡 OK' : '🟢 FAST';
                return (
                  <tr key={i}>
                    <td><span className="status-pill s-vendor">{v.code}</span></td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: 'var(--accent6)' }}>{v.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${v.pct}%`, height: '100%', background: '#b24bff', borderRadius: 4 }}/>
                        </div>
                        <span style={{ color: 'var(--accent6)', fontWeight: 700 }}>{v.pct}%</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: overdue ? 'var(--danger)' : 'var(--warning)' }}>{v.avgDays != null ? `${v.avgDays}d` : '—'}</td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, color: 'var(--accent4)' }}>{v.maxDays != null ? `${v.maxDays}d` : '—'}</td>
                    <td style={{ color: v.delayed > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700, fontFamily: 'Rajdhani', fontSize: 17 }}>{v.delayed}</td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: 'var(--accent1)' }}>{v.avgDays != null ? `${v.avgDays}d` : '—'}</td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: v.processEfficiency >= 80 ? 'var(--success)' : v.processEfficiency >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{v.processEfficiency != null ? `${v.processEfficiency}%` : '—'}</td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: v.slaViolations > 0 ? 'var(--danger)' : 'var(--success)' }}>{v.slaViolations || 0}</td>
                    <td className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtTs(latestTs)}</td>
                    <td style={{ fontSize: 12 }}>{rating}</td>
                    <td style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.items.slice(0, 3).map(it => it.product).join(' · ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-header"><div className="chart-title">Vendor Process Aging & Cycle Time — Item Level (Today Reference)</div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SC</th><th>PO</th><th>PRODUCT</th><th>PROCESS</th><th>LAST UPDATE</th><th>PENDING DAYS</th><th>CYCLE TIME</th><th>SLA STATUS</th><th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data
                .filter(r => r.inhouse === 'VENDOR')
                .map(r => {
                  const pendingDays = daysBetween(r.timestamp, todayRef);
                  const cycleTime = calculateProcessCycleTime(r.poDate, r.timestamp);
                  const slaViolation = pendingDays !== null && pendingDays > 2;
                  return { ...r, pendingDays, cycleTime, slaViolation };
                })
                .sort((a, b) => (b.pendingDays || 0) - (a.pendingDays || 0))
                .slice(0, 300)
                .map((r, i) => {
                  const pending = r.pendingDays;
                  const cycle = r.cycleTime;
                  const overdue = pending != null && pending > TARGET_DAYS;
                  const slaStatus = r.slaViolation ? 'VIOLATION' : 'COMPLIANT';
                  return (
                    <tr key={`${r.sc || '—'}-${r.po}-${i}`} onClick={() => setSelectedItem(r)} style={{ cursor: 'pointer', backgroundColor: selectedItem === r ? 'rgba(255,107,53,0.08)' : 'transparent' }} title="Click to view item details">
                      <td>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedSC(r.sc); }}
                          className="mono text-accent fw7"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
                          title={`View all products for SC ${r.sc || '—'}`}
                        >
                          {r.sc || '—'}
                        </button>
                      </td>
                      <td style={{ fontSize: 11 }}>{r.po || '—'}</td>
                      <td style={{ fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product || '—'}</td>
                      <td><span className="status-pill s-vendor">{r.currentStage || 'UNKNOWN'}</span></td>
                      <td className="mono" style={{ fontSize: 10 }}>{fmtTs(r.timestamp)}</td>
                      <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: overdue ? 'var(--danger)' : 'var(--success)' }}>{pending != null ? `${pending}d` : '—'}</td>
                      <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: 'var(--accent1)' }}>{cycle != null ? `${cycle}d` : '—'}</td>
                      <td><span className={`status-pill ${r.slaViolation ? 'badge-red' : 'badge-green'}`}>{slaStatus}</span></td>
                      <td><span className={`status-pill ${overdue ? 'badge-red' : 'badge-green'}`}>{overdue ? 'DELAYED' : 'ACTIVE'}</span></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SC Detail Modal */}
      {selectedSC && (
        <div className="table-card" style={{ marginTop: 20, border: '2px solid var(--accent1)', boxShadow: '0 0 20px rgba(0,201,255,0.15)' }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,201,255,0.05)' }}>
            <div>
              <div className="chart-title" style={{ color: 'var(--accent1)' }}>📦 SC {selectedSC} — Vendor Products & Processing Status</div>
              <div className="chart-sub">
                {data.filter(r => r.sc === selectedSC && r.inhouse === 'VENDOR').length} vendor items in this SC set
              </div>
            </div>
            <button
              onClick={() => setSelectedSC(null)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
            >
              CLOSE
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PO</th>
                  <th>PRODUCT NAME</th>
                  <th>TYPE</th>
                  <th>PROCESS STAGE</th>
                  <th>LAST UPDATE</th>
                  <th>CYCLE TIME</th>
                  <th>PENDING DAYS</th>
                  <th>PROCESSING STATUS</th>
                  <th>SLA COMPLIANCE</th>
                  <th>OVERALL STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter(r => r.sc === selectedSC && r.inhouse === 'VENDOR')
                  .map((item, idx) => {
                    const cycleTime = calculateProcessCycleTime(item.poDate, item.timestamp);
                    const now = new Date();
                    const today =
                      now.getFullYear() + '-' +
                      String(now.getMonth() + 1).padStart(2, '0') + '-' +
                      String(now.getDate()).padStart(2, '0');
                    const pendingDays = daysBetween(item.timestamp, today);
                    const isDelayed = pendingDays !== null && pendingDays > 2;
                    const isOnTime = cycleTime !== null && cycleTime <= 21;
                    const completionStatus = ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(item.currentStage);
                    
                    return (
                      <tr key={`${selectedSC}-${idx}`} style={{ backgroundColor: isDelayed ? 'rgba(255,61,90,0.08)' : completionStatus ? 'rgba(0,230,118,0.08)' : 'transparent' }}>
                        <td className="mono" style={{ fontSize: 11 }}>{item.po}</td>
                        <td style={{ fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product}</td>
                        <td><span className="status-pill badge-blue">{item.type}</span></td>
                        <td>
                          <span className="status-pill s-vendor" style={{ fontSize: 10 }}>
                            {item.currentStage}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtTs(item.timestamp)}</td>
                        <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: 'var(--accent1)' }}>
                          {cycleTime !== null ? `${cycleTime}d` : '—'}
                        </td>
                        <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: isDelayed ? 'var(--danger)' : 'var(--success)' }}>
                          {pendingDays !== null ? `${pendingDays}d` : '—'}
                        </td>
                        <td>
                          <span className={`status-pill ${completionStatus ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                            {completionStatus ? '✓ COMPLETED' : '⏳ PROCESSING'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isDelayed ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 10 }}>
                            {isDelayed ? '⚠ VIOLATION' : '✓ COMPLIANT'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isOnTime && completionStatus ? 'badge-green' : isDelayed ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                            {isOnTime && completionStatus ? '🟢 ON-TIME' : isDelayed ? '🔴 DELAYED' : completionStatus ? '🟢 EARLY' : '🟡 IN-PROGRESS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '16px 18px', backgroundColor: 'rgba(0,201,255,0.02)', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
              {(() => {
                const scItems = data.filter(r => r.sc === selectedSC && r.inhouse === 'VENDOR');
                const totalItems = scItems.length;
                const completedItems = scItems.filter(r => ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(r.currentStage)).length;
                const delayedItems = scItems.filter(r => {
                  const now = new Date();
                  const today =
                    now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0');
                  const pending = daysBetween(r.timestamp, today);
                  return pending !== null && pending > 2;
                }).length;
                const avgCycleTime = scItems.reduce((sum, r) => {
                  const cycle = calculateProcessCycleTime(r.poDate, r.timestamp);
                  return sum + (cycle !== null ? cycle : 0);
                }, 0) / Math.max(totalItems, 1);

                return (
                  <>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Total Items in SC</div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: 'var(--accent1)' }}>{totalItems}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Completed</div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{completedItems} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalItems > 0 ? `(${Math.round(completedItems / totalItems * 100)}%)` : ''}</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Delayed Items (2d+)</div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: delayedItems > 0 ? 'var(--danger)' : 'var(--success)' }}>{delayedItems}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Avg Cycle Time</div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, color: avgCycleTime <= 21 ? 'var(--success)' : 'var(--warning)' }}>{Math.round(avgCycleTime)}d</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="table-card" style={{ marginTop: 20, border: '2px solid var(--accent4)', boxShadow: '0 0 30px rgba(255,107,53,0.2)' }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,107,53,0.05)' }}>
            <div>
              <div className="chart-title" style={{ color: 'var(--accent4)' }}>📋 Item Details</div>
              <div className="chart-sub">Complete information for {selectedItem.sc}</div>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
            >
              CLOSE
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 20 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase'}}>PO Number</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 16, fontWeight: 700, color: 'var(--accent1)' }}>{selectedItem.po}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase'}}>SC Number</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 16, fontWeight: 700, color: 'var(--accent1)' }}>{selectedItem.sc}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase'}}>Product Type</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent2)' }}>{selectedItem.type}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase'}}>Product Name</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedItem.product}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
              {(() => {
                const cycle = calculateProcessCycleTime(selectedItem.poDate, selectedItem.timestamp);
                const now = new Date();
                const today =
                  now.getFullYear() + '-' +
                  String(now.getMonth() + 1).padStart(2, '0') + '-' +
                  String(now.getDate()).padStart(2, '0');
                const pending = daysBetween(selectedItem.timestamp, today);
                const isDelayed = pending !== null && pending > 2;
                const isOnTime = cycle !== null && cycle <= 21;

                return (
                  <>
                    <div style={{ background: 'rgba(0,201,255,0.1)', border: '1px solid rgba(0,201,255,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>Current Stage</div>
                      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 14, fontWeight: 700, color: 'var(--accent1)' }}>{selectedItem.currentStage}</div>
                    </div>
                    <div style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>Cycle Time</div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: isOnTime ? 'var(--success)' : 'var(--warning)' }}>{cycle !== null ? `${cycle} days` : '—'}</div>
                    </div>
                    <div style={{ background: `rgba(${isDelayed ? '255,61,90' : '0,230,118'},0.1)`, border: `1px solid rgba(${isDelayed ? '255,61,90' : '0,230,118'},0.3)`, borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>Pending Days</div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: isDelayed ? 'var(--danger)' : 'var(--success)' }}>{pending !== null ? `${pending} days` : '—'}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>Last Update</div>
                      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-secondary)' }}>{fmtTs(selectedItem.timestamp)}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
              {(() => {
                const cycle = calculateProcessCycleTime(selectedItem.poDate, selectedItem.timestamp);
                const now = new Date();
                const today =
                  now.getFullYear() + '-' +
                  String(now.getMonth() + 1).padStart(2, '0') + '-' +
                  String(now.getDate()).padStart(2, '0');
                const pending = daysBetween(selectedItem.timestamp, today);
                const isDelayed = pending !== null && pending > 2;
                const isOnTime = cycle !== null && cycle <= 21;
                const isCompleted = ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(selectedItem.currentStage);

                return (
                  <>
                    <div>
                      <span className={`status-pill ${isCompleted ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 11 }}>
                        {isCompleted ? '✓ COMPLETED' : '⏳ PROCESSING'}
                      </span>
                    </div>
                    <div>
                      <span className={`status-pill ${isDelayed ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 11 }}>
                        {isDelayed ? '⚠ SLA VIOLATION' : '✓ COMPLIANT'}
                      </span>
                    </div>
                    <div>
                      <span className={`status-pill ${isOnTime && isCompleted ? 'badge-green' : isDelayed ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: 11 }}>
                        {isOnTime && isCompleted ? '🟢 ON-TIME' : isDelayed ? '🔴 DELAYED' : isCompleted ? '🟢 EARLY' : '🟡 IN-PROGRESS'}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ background: 'rgba(0,201,255,0.05)', border: '1px dashed rgba(0,201,255,0.3)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>📌 Quick Actions</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button 
                  onClick={() => { setSelectedItem(null); setSelectedSC(selectedItem.sc); }}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                >
                  View SC {selectedItem.sc} Details
                </button>
                 {setActiveNav && (
                  <button 
                    onClick={() => { 
                      if (setSelectedPONum) {
                        setSelectedPONum(selectedItem.po);
                      }
                      setSelectedItem(null); 
                      setActiveNav('po'); 
                    }}
                    style={{ background: 'rgba(0,201,255,0.1)', border: '1px solid rgba(0,201,255,0.3)', color: 'var(--accent1)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                  >
                    View in PO Analysis
                  </button>
                )}
                {setActiveNav && (
                  <button 
                    onClick={() => { setSelectedItem(null); setActiveNav('wip'); }}
                    style={{ background: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.3)', color: 'var(--accent5)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                  >
                    View in Stage / WIP
                  </button>
                )}
                <button 
                  onClick={() => setSelectedItem(null)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 10 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorPage;