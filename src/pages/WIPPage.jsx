import React from 'react';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FilterContext';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
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
// ─── WORK IN PROGRESS (WIP) PAGE COMPONENT ────────────────────────────────────

function WIPPage() {
  const { kpis } = useData();
  const { filters } = useFilters();
  const { rows: filtered, isLoading } = useProductionDataQuery(filters, 1, 200);
  const [selectedStage, setSelectedStage] = React.useState(null);
  const [expandedItem, setExpandedItem] = React.useState(null);
  const wipRef = React.useRef();
  const stages = Object.entries(kpis.stageCounts).sort((a, b) => b[1] - a[1]);

  useChart(
    wipRef,
    {
      type: 'bar',
      data: {
        labels: stages.map((s) => s[0]),
        datasets: [
          {
            label: 'Items',
            data: stages.map((s) => s[1]),
            backgroundColor: stages.map((s) => getStageColor(s[0]) + '88'),
            borderColor: stages.map((s) => getStageColor(s[0])),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } },
          y: { ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { display: false } },
        },
      },
    },
    [kpis]
  );

  const stageEntries = stages.map(([stage, count]) => ({ stage, count }));
  const maxStageCount = stageEntries.length > 0 ? Math.max(...stageEntries.map((s) => s.count)) : 1;

  return (
    <div>
      <div className="section-title">
        Stage / WIP <span>Analysis</span>
        <div className="section-line" />
      </div>
      <div className="kpi-grid">
        {stageEntries.map((s) => (
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
          <div className="chart-wrap-lg">
            <canvas ref={wipRef} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Stage Summary</div>
          <div className="chart-sub">INDIVIDUAL STAGES ONLY — NO COMBINED GROUPS</div>
          <div className="vendor-bar-wrap" style={{ marginTop: 8 }}>
            {stageEntries.map((s) => (
              <div className="vendor-row" key={s.stage}>
                <div className="vendor-name">{s.stage}</div>
                <div className="vendor-bar-bg">
                  <div
                    className="vendor-bar-fill"
                    style={{
                      width: `${Math.min(100, (s.count / maxStageCount) * 100)}%`,
                      background: 'linear-gradient(90deg,#00c9ff,#b24bff)',
                    }}
                  />
                </div>
                <div className="vendor-val">{s.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="table-card">
        <div className="table-header">
          <div className="chart-title">All Items by Stage — Separate Individual Items</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO</th>
                <th>SC</th>
                <th>PRODUCT</th>
                <th>DAYS PENDING</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r, i) => (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => setExpandedItem(expandedItem === i ? null : i)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: expandedItem === i ? 'rgba(0,201,255,0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ fontSize: 11 }} className="mono">
                      {r.po}
                    </td>
                    <td className="mono text-accent">{r.sc || '—'}</td>
                    <td
                      style={{
                        maxWidth: 350,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.product || '—'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'Rajdhani',
                          fontWeight: 700,
                          fontSize: 14,
                          color: (r.pendingDays || 0) > 2 ? 'var(--danger)' : 'var(--success)',
                        }}
                      >
                        {r.pendingDays != null ? `${r.pendingDays} days` : '—'}
                      </span>
                    </td>
                  </tr>
                  {expandedItem === i && (
                    <tr
                      style={{
                        backgroundColor: 'rgba(0,201,255,0.04)',
                        borderBottom: '2px solid var(--border)',
                      }}
                    >
                      <td colSpan="4" style={{ padding: '16px' }}>
                        <div
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}
                        >
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              PO Number
                            </div>
                            <div
                              style={{
                                fontFamily: 'Share Tech Mono',
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--accent1)',
                              }}
                            >
                              {r.po}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              SC Number
                            </div>
                            <div
                              style={{
                                fontFamily: 'Share Tech Mono',
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--accent1)',
                              }}
                            >
                              {r.sc || '—'}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              Product Type & Category
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {r.type}{' '}
                              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                                ({getProductCategory(r.type)})
                              </span>
                            </div>
                          </div>
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              Days Pending
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color:
                                  (r.pendingDays || 0) > 2 ? 'var(--danger)' : 'var(--success)',
                              }}
                            >
                              {r.pendingDays != null ? `${r.pendingDays}d` : '-'}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4,1fr)',
                            gap: 16,
                            marginTop: 14,
                            borderTop: '1px solid rgba(26,58,92,0.2)',
                            paddingTop: 12,
                          }}
                        >
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              Current Stage
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: getStageColor(r.currentStage),
                              }}
                            >
                              {r.currentStage}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              Workload Location
                            </div>
                            <span
                              className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}
                              style={{ fontSize: 9 }}
                            >
                              {r.inhouse}
                            </span>
                          </div>
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              Processing Comments
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {r.status1 ? <div>Status 1: {r.status1}</div> : null}
                              {r.status2 ? <div>Status 2: {r.status2}</div> : null}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}
                            >
                              Last Edit/Update Timestamp
                            </div>
                            <div
                              style={{
                                fontFamily: 'Share Tech Mono',
                                fontSize: 11,
                                color: 'var(--text-muted)',
                              }}
                            >
                              {fmtTs(r.timestamp)}
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

export default WIPPage;
