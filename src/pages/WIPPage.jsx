import React, { useState } from 'react';
import { useKpisQuery, useDashboardDataQuery } from '../hooks/queries/useDashboardQueries';
import { useFilters } from '../context/FilterContext';
import { getStageColor } from '../services/dataNormalizer';
import { getProductCategory } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import VirtualizedTable from '../components/ui/VirtualizedTable';
import useChart from '../utils/chartUtils';
import { LoadingScreen } from '../components/LoadingScreen';

// ─── WORK IN PROGRESS (WIP) PAGE COMPONENT ────────────────────────────────────

function WIPPage() {
  const { filters } = useFilters();
  const { data: kpiRes, isLoading: kpisLoading } = useKpisQuery(filters);
  const kpis = kpiRes?.data || { stageCounts: {} };

  const { data: tableRes, isLoading: tableLoading } = useDashboardDataQuery(filters, 1, 500);
  const filtered = tableRes?.data?.rows || [];

  const [expandedItem, setExpandedItem] = useState(null);
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

  if (kpisLoading) {
    return <div style={{ padding: 40, color: '#fff' }}>Loading Stage/WIP Stats...</div>;
  }

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
        <VirtualizedTable
          headers={['PO', 'SC', 'PRODUCT', 'DAYS PENDING']}
          data={filtered}
          height={600}
          isLoading={tableLoading}
          RowComponent={({ row: r, index: i }) => (
            <>
              <div style={{ flex: 1, padding: '0 12px', fontSize: 11 }} className="mono">{r.po}</div>
              <div style={{ flex: 1, padding: '0 12px' }} className="mono text-accent">{r.sc || '—'}</div>
              <div style={{ flex: 1, padding: '0 12px', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.product || '—'}
              </div>
              <div style={{ flex: 1, padding: '0 12px' }}>
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
              </div>
            </>
          )}
          isEmpty={filtered.length === 0}
        />
      </div>
    </div>
  );
}

export default WIPPage;
