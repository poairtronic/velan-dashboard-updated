import React from 'react';
import { useData } from '../context/DataContext';
import { getStageColor } from '../services/dataNormalizer';
import {
  workingDaysBetween,
  daysBetween,
  calculateProcessCycleTime,
  isSCComplete,
  getSCLastTimestamp,
  getProductCategory,
} from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
// ─── BOTTLENECK PAGE COMPONENT ────────────────────────────────────────────────

function BottleneckPage() {
  const { kpis, filtered } = useData();
  const scoreRef = React.useRef();
  const queueRef = React.useRef();
  const [timeSearch, setTimeSearch] = React.useState('');

  const stages = kpis.bottleneckStages.filter((s) => s.count > 0);
  const maxScore = stages.length > 0 ? stages[0].score : 1;
  const top = kpis.topBottleneck;

  // Export helpers - export "Items Currently Stuck" table
  function getStuckRows() {
    if (!top) return [];
    const today = new Date().toISOString().substring(0, 10);
    return filtered
      .filter((r) => r.currentStage === top.stage)
      .map((r) => {
        const days = Math.ceil(daysBetween(r.timestamp?.substring(0, 10), today) || 0);
        return {
          SC: r.sc || '—',
          PO: r.po || '—',
          Product: r.product || '—',
          Type: r.type || '—',
          'Status 1': r.status1 || '',
          'Days Stuck': days,
          Inhouse: r.inhouse || '',
          Timestamp: r.timestamp?.substring(0, 10) || '',
        };
      });
  }

  async function exportExcel() {
    const rows = getStuckRows();
    if (!rows.length) return;
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 24 },
      { wch: 36 },
      { wch: 10 },
      { wch: 28 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Stuck_${top?.stage || 'items'}`);
    const d = new Date();
    XLSX.writeFile(
      wb,
      `stuck_${top?.stage || 'items'}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`
    );
  }

  function exportCSV() {
    const rows = getStuckRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `stuck_${top?.stage || 'items'}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const rows = getStuckRows();
    const blob = new Blob(
      [
        JSON.stringify(
          { stage: top?.stage, exportDate: new Date().toISOString(), items: rows },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `stuck_${top?.stage || 'items'}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const rows = getStuckRows();
    if (!rows.length) return;
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    const d = new Date();
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text(`Items Stuck in ${top?.stage || '—'}`, 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `Velan Metrology · ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} · ${rows.length} items`,
      14,
      20
    );
    doc.autoTable({
      startY: 26,
      head: [['SC', 'PO', 'Product', 'Type', 'Status 1', 'Days', 'Inhouse', 'Timestamp']],
      body: rows.map((r) => [
        r.SC,
        r.PO,
        r.Product,
        r.Type,
        r['Status 1'],
        r['Days Stuck'],
        r.Inhouse,
        r.Timestamp,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 31, 53] },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      columnStyles: { 5: { halign: 'center' }, 6: { halign: 'center' } },
    });
    doc.save(
      `stuck_${top?.stage || 'items'}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.pdf`
    );
  }

  useChart(
    scoreRef,
    {
      type: 'bar',
      data: {
        labels: stages.slice(0, 12).map((s) => s.stage),
        datasets: [
          {
            label: 'Bottleneck Score (Queue × Duration)',
            data: stages.slice(0, 12).map((s) => Math.round(s.score * 10) / 10),
            backgroundColor: stages
              .slice(0, 12)
              .map((s, i) => (i === 0 ? '#ff3d5a99' : i < 3 ? '#ffd60a99' : '#00c9ff44')),
            borderColor: stages
              .slice(0, 12)
              .map((s, i) => (i === 0 ? '#ff3d5a' : i < 3 ? '#ffd60a' : '#00c9ff')),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `Score: ${c.parsed.y} (items × avg days)` } },
        },
        scales: {
          x: {
            ticks: { color: '#7ba7cc', font: { size: 10 } },
            grid: { color: 'rgba(26,58,92,0.3)' },
          },
          y: {
            ticks: { color: '#7ba7cc' },
            grid: { color: 'rgba(26,58,92,0.3)' },
            title: { display: true, text: 'Bottleneck Score', color: '#7ba7cc' },
          },
        },
      },
    },
    [kpis]
  );

  useChart(
    queueRef,
    {
      type: 'bar',
      data: {
        labels: stages.slice(0, 12).map((s) => s.stage),
        datasets: [
          {
            label: 'Queue (items)',
            data: stages.slice(0, 12).map((s) => s.count),
            backgroundColor: '#ffd60a99',
            borderColor: '#ffd60a',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Avg Days',
            data: stages.slice(0, 12).map((s) => Math.round(s.duration * 10) / 10),
            backgroundColor: '#b24bff99',
            borderColor: '#b24bff',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#7ba7cc' } } },
        scales: {
          x: {
            ticks: { color: '#7ba7cc', font: { size: 10 } },
            grid: { color: 'rgba(26,58,92,0.3)' },
          },
          y: {
            ticks: { color: '#ffd60a' },
            grid: { color: 'rgba(26,58,92,0.2)' },
            title: { display: true, text: 'Queue (items)', color: '#ffd60a' },
          },
          y2: {
            position: 'right',
            ticks: { color: '#b24bff' },
            grid: { display: false },
            title: { display: true, text: 'Avg Days', color: '#b24bff' },
          },
        },
      },
    },
    [kpis]
  );

  return (
    <div>
      <div className="section-title">
        🔴 Bottleneck <span>Detection</span>
        <div className="section-line" />
      </div>

      {top && (
        <div
          style={{
            background: 'rgba(255,61,90,0.1)',
            border: '2px solid rgba(255,61,90,0.5)',
            borderRadius: 12,
            padding: '18px 22px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <div style={{ fontSize: 40 }}>🚨</div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'Share Tech Mono',
                fontSize: 11,
                color: 'var(--danger)',
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              TOP BOTTLENECK STAGE DETECTED
            </div>
            <div
              style={{
                fontFamily: 'Rajdhani',
                fontWeight: 800,
                fontSize: 32,
                color: 'var(--danger)',
              }}
            >
              {top.stage}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              {top.count} items queued · ~{Math.round(top.duration * 10) / 10} days avg duration ·
              Score: {Math.round(top.score * 10) / 10}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-muted)' }}
            >
              BOTTLENECK SCORE
            </div>
            <div
              style={{
                fontFamily: 'Rajdhani',
                fontSize: 48,
                fontWeight: 800,
                color: 'var(--danger)',
                lineHeight: 1,
              }}
            >
              {Math.round(top.score)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>queue × avg-days</div>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <KPICard
          label="TOP BOTTLENECK"
          value={top?.stage || '—'}
          sub={`${top?.count || 0} items · ${Math.round((top?.duration || 0) * 10) / 10}d avg`}
          color1="#ff3d5a"
          color2="#ff6b35"
          badge={{ text: 'CRITICAL', cls: 'badge-red' }}
        />
        <KPICard
          label="2ND BOTTLENECK"
          value={stages[1]?.stage || '—'}
          sub={`${stages[1]?.count || 0} items queued`}
          color1="#ffd60a"
          color2="#ff6b35"
          badge={{ text: 'HIGH', cls: 'badge-yellow' }}
        />
        <KPICard
          label="3RD BOTTLENECK"
          value={stages[2]?.stage || '—'}
          sub={`${stages[2]?.count || 0} items queued`}
          color1="#ffd60a"
          color2="#ff6b35"
          badge={{ text: 'MEDIUM', cls: 'badge-yellow' }}
        />
        <KPICard
          label="TOTAL ITEMS"
          value={stages.reduce((s, x) => s + x.count, 0)}
          sub="items in non-output stages"
          color1="#ff3d5a"
          color2="#b24bff"
        />
        <KPICard
          label="STAGES MONITORED"
          value={stages.length}
          sub="active WIP stages"
          color1="#00c9ff"
          color2="#0fa8e0"
        />
        <KPICard
          label="VENDOR BOTTLENECK"
          value={filtered.filter((r) => r.inhouse === 'VENDOR').length}
          sub="items waiting at vendors"
          color1="#b24bff"
          color2="#ff6b35"
        />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">🔴 Bottleneck Score by Stage</div>
          <div className="chart-sub">SCORE = QUEUE SIZE × AVG DAYS IN STAGE · HIGHER = WORSE</div>
          <div className="chart-wrap-lg">
            <canvas ref={scoreRef} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">📊 Queue Size vs Avg Duration</div>
          <div className="chart-sub">
            DUAL AXIS: ITEMS IN QUEUE (YELLOW) vs DAYS IN STAGE (PURPLE)
          </div>
          <div className="chart-wrap-lg">
            <canvas ref={queueRef} />
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div className="chart-title">Bottleneck Ranking — All Stages</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>RANK</th>
                <th>STAGE</th>
                <th>QUEUE (ITEMS)</th>
                <th>AVG DAYS IN STAGE</th>
                <th>SCORE</th>
                <th>SEVERITY</th>
                <th>SCORE BAR</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => {
                const pct = Math.min(100, Math.round((s.score / maxScore) * 100));
                const severity =
                  i === 0 ? '🔴 CRITICAL' : i < 3 ? '🟡 HIGH' : i < 6 ? '🟠 MEDIUM' : '🟢 LOW';
                const color =
                  i === 0
                    ? 'var(--danger)'
                    : i < 3
                      ? 'var(--warning)'
                      : i < 6
                        ? '#ff6b35'
                        : 'var(--success)';
                return (
                  <tr key={i}>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 800,
                        fontSize: 20,
                        color:
                          i === 0
                            ? 'var(--danger)'
                            : i < 3
                              ? 'var(--warning)'
                              : 'var(--text-muted)',
                      }}
                    >
                      {i + 1}
                    </td>
                    <td>
                      <span
                        className="status-pill"
                        style={{
                          background: getStageColor(s.stage) + '22',
                          color: getStageColor(s.stage),
                        }}
                      >
                        {s.stage}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 18,
                        color: 'var(--warning)',
                      }}
                    >
                      {s.count}
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 18,
                        color: '#b24bff',
                      }}
                    >
                      {Math.round(s.duration * 10) / 10}d
                    </td>
                    <td style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color }}>
                      {Math.round(s.score * 10) / 10}
                    </td>
                    <td style={{ fontSize: 12 }}>{severity}</td>
                    <td style={{ minWidth: 120 }}>
                      <div
                        style={{
                          height: 10,
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: 5,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: color,
                            borderRadius: 5,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {top && (
        <div className="table-card" style={{ marginTop: 0 }}>
          <div className="table-header">
            <div className="chart-title">🔴 Items Currently Stuck in {top.stage}</div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button
                onClick={exportExcel}
                title="Export to Excel"
                style={{
                  background: 'rgba(0,230,118,0.1)',
                  border: '1px solid rgba(0,230,118,0.35)',
                  color: 'var(--success)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: 'Share Tech Mono,monospace',
                  fontWeight: 700,
                }}
              >
                ⬇ XLS
              </button>
              <button
                onClick={exportCSV}
                title="Export to CSV"
                style={{
                  background: 'rgba(0,201,255,0.1)',
                  border: '1px solid rgba(0,201,255,0.35)',
                  color: 'var(--accent1)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: 'Share Tech Mono,monospace',
                  fontWeight: 700,
                }}
              >
                ⬇ CSV
              </button>
              <button
                onClick={exportPDF}
                title="Export to PDF"
                style={{
                  background: 'rgba(255,61,90,0.1)',
                  border: '1px solid rgba(255,61,90,0.35)',
                  color: 'var(--danger)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: 'Share Tech Mono,monospace',
                  fontWeight: 700,
                }}
              >
                ⬇ PDF
              </button>
              <button
                onClick={exportJSON}
                title="Export to JSON"
                style={{
                  background: 'rgba(255,214,10,0.1)',
                  border: '1px solid rgba(255,214,10,0.35)',
                  color: 'var(--accent5)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: 'Share Tech Mono,monospace',
                  fontWeight: 700,
                }}
              >
                ⬇ JSON
              </button>
            </div>
          </div>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Filter by Days:
            </label>
            <input
              type="text"
              placeholder="Type # of days (e.g., 2, 3)"
              value={timeSearch}
              onChange={(e) => setTimeSearch(e.target.value)}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                fontSize: 12,
                width: 200,
              }}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SC</th>
                  <th>PO</th>
                  <th>PRODUCT</th>
                  <th>TYPE</th>
                  <th>STATUS 1</th>
                  <th>DAYS</th>
                  <th>INHOUSE</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .filter((r) => r.currentStage === top.stage)
                  .map((r, i) => {
                    const today = new Date().toISOString().substring(0, 10);
                    const days = Math.ceil(daysBetween(r.timestamp?.substring(0, 10), today));
                    const matchesSearch =
                      !timeSearch.trim() || days >= parseInt(timeSearch.trim(), 10);
                    return matchesSearch ? (
                      <tr key={i}>
                        <td className="mono text-accent">{r.sc || '—'}</td>
                        <td style={{ fontSize: 11 }}>{r.po}</td>
                        <td
                          style={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.product || '—'}
                        </td>
                        <td>
                          <span className="status-pill badge-blue">{r.type || '—'}</span>
                        </td>
                        <td
                          style={{
                            fontSize: 10,
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.status1}
                        </td>
                        <td
                          style={{
                            fontFamily: 'Rajdhani',
                            fontWeight: 700,
                            fontSize: 14,
                            color:
                              days > 5
                                ? 'var(--danger)'
                                : days > 2
                                  ? 'var(--warning)'
                                  : 'var(--text-secondary)',
                          }}
                        >
                          {days}d
                        </td>
                        <td>
                          <span
                            className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}
                          >
                            {r.inhouse}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 10 }}>
                          {r.timestamp?.substring(0, 10)}
                        </td>
                      </tr>
                    ) : null;
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BottleneckPage;
