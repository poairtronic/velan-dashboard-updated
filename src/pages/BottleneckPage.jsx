import React from 'react';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FilterContext';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import { getStageColor } from '../services/dataNormalizer';
import calculationUtils from '../utils/calculationUtils';
const { workingDaysBetween,
  daysBetween,
  calculateProcessCycleTime,
  isSCComplete,
  getSCLastTimestamp,
  getProductCategory,
 } = calculationUtils;
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import useChart from '../utils/chartUtils';
// ─── BOTTLENECK PAGE COMPONENT ────────────────────────────────────────────────

function BottleneckPage() {
  const { kpis } = useData();
  const { filters } = useFilters();
  const scoreRef = React.useRef();
  const queueRef = React.useRef();
  const [timeSearch, setTimeSearch] = React.useState('');

  const stages = kpis.bottleneckStages.filter((s) => s.count > 0);
  const maxScore = stages.length > 0 ? stages[0].score : 1;
  const top = kpis.topBottleneck;

  // Use a query specifically for the top bottleneck stage to display its stuck items
  const queryFilters = React.useMemo(() => {
    if (!top) return filters;
    return { ...filters, stage: top.stage };
  }, [filters, top]);
  
  const { rows: stuckRows } = useProductionDataQuery(queryFilters, 1, 5000);

  // Export helpers - export "Items Currently Stuck" table
  function getStuckRows() {
    if (!top) return [];
    const today = new Date().toISOString().substring(0, 10);
    return stuckRows.map((r) => {
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
          value={kpis.vendor || 0}
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
                {stuckRows.map((r, i) => {
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
