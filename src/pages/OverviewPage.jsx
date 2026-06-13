import React, { useState } from 'react';
import { useKpisQuery, useDashboardDataQuery, useBottlenecksQuery } from '../hooks/queries/useDashboardQueries';
import { useFilters } from '../context/FilterContext';
import { getStageColor } from '../services/dataNormalizer';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import VirtualizedTable from '../components/ui/VirtualizedTable';
import useChart from '../utils/chartUtils';
import { fmtTs } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { LoadingScreen } from '../components/LoadingScreen'; // assuming we have this

function OverviewPage() {
  const { filters } = useFilters();
  const { data: kpiData, isLoading: isKpiLoading } = useKpisQuery(filters);
  const { data: bottleneckData, isLoading: isBnLoading } = useBottlenecksQuery(filters);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showReadyDetails, setShowReadyDetails] = useState(false);

  const stageChartRef = React.useRef();
  const donutRef = React.useRef();
  const typeChartRef = React.useRef();

  // Safely extract data
  const kpis = kpiData?.data || {
    totalRows: 0,
    totalPOs: 0,
    ready: 0,
    wip: 0,
    inhouseCount: 0,
    vendorCount: 0,
    delayed: 0,
    stageCounts: {},
  };

  const bottlenecks = bottleneckData?.data?.bottlenecks || [];

  const stages = Object.entries(kpis.stageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  useChart(
    stageChartRef,
    {
      type: 'bar',
      data: {
        labels: stages.map((s) => s[0]),
        datasets: [
          {
            label: 'Items',
            data: stages.map((s) => s[1]),
            backgroundColor: stages.map((s) => getStageColor(s[0]) + '99'),
            borderColor: stages.map((s) => getStageColor(s[0])),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7ba7cc', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
          y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } },
        },
      },
    },
    [stages]
  );

  useChart(
    donutRef,
    {
      type: 'doughnut',
      data: {
        labels: ['Inhouse', 'Vendor'],
        datasets: [
          {
            data: [kpis.inhouseCount, kpis.vendorCount],
            backgroundColor: ['#00c9ff99', '#b24bff99'],
            borderColor: ['#00c9ff', '#b24bff'],
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#7ba7cc', font: { size: 11 } } } },
      },
    },
    [kpis.inhouseCount, kpis.vendorCount]
  );

  // We can add a pie chart for type counts similarly if the backend returns it.
  // For now we'll leave it empty or mock it since we didn't add it to queryBuilder yet.

  const categoryCards = [
    {
      id: 'ready',
      label: 'READY SET',
      value: kpis.ready,
      sub: 'items ready or in stores',
      color1: '#00c9ff',
      color2: '#0fa8e0',
    },
    {
      id: 'delayed',
      label: 'DELAYED SC',
      value: kpis.delayed,
      sub: 'items in delayed POs',
      color1: '#ff3d5a',
      color2: '#ff6b35',
    },
    {
      id: 'inprogress',
      label: 'INPROGRESS',
      value: kpis.wip,
      sub: 'items in production',
      color1: '#ffd60a',
      color2: '#b24bff',
    },
  ];

  if (isKpiLoading || isBnLoading) {
    // If we have a LoadingScreen component, use it
    return <div style={{ padding: 40, color: '#fff' }}>Loading Overview...</div>;
  }

  const onTimePct = kpis.totalPOs > 0 ? Math.round(((kpis.totalPOs - kpis.delayed) / kpis.totalPOs) * 100) : 100;
  const inhousePct = kpis.totalRows > 0 ? Math.round((kpis.inhouseCount / kpis.totalRows) * 100) : 0;

  return (
    <div>
      <div className="section-title">
        Overview <span>Dashboard</span>
        <div className="section-line" />
      </div>

      <div className="kpi-grid">
        <KPICard
          label="TOTAL ITEMS"
          value={kpis.totalRows}
          sub="in current view"
          color1="#00c9ff"
          color2="#0fa8e0"
        />
        <KPICard
          label="READY / DAILY OUT"
          value={kpis.ready}
          sub="sets ready to dispatch"
          color1="#00e676"
          color2="#00c9ff"
          action={{ text: 'View ready details', onClick: () => setShowReadyDetails(true) }}
        />
        <KPICard
          label="IN PROGRESS (WIP)"
          value={kpis.wip}
          sub="items active in production"
          color1="#ffd60a"
          color2="#ff6b35"
        />
        <KPICard
          label="ON-TIME COMPLETION"
          value={`${onTimePct}%`}
          sub={`${kpis.totalPOs - kpis.delayed} of ${kpis.totalPOs} POs within 3 weeks`}
          color1="#00ff9d"
          color2="#00c9ff"
          badge={{ text: `${kpis.delayed} delayed`, cls: 'badge-red' }}
        />
        <KPICard
          label="DELAYED POs"
          value={kpis.delayed}
          sub="exceeded 21-day target"
          color1="#ff3d5a"
          color2="#ff6b35"
        />
        <KPICard
          label="INHOUSE WORKLOAD"
          value={`${inhousePct}%`}
          sub={`${kpis.inhouseCount} inhouse · ${kpis.vendorCount} vendor`}
          color1="#00c9ff"
          color2="#b24bff"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {categoryCards.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              background: `linear-gradient(135deg,${cat.color1}15,${cat.color2}08)`,
              border: `1px solid ${cat.color1}40`,
              borderRadius: 10,
              padding: 16,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>
              {cat.label}
            </div>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 32, fontWeight: 700, color: cat.color1, marginBottom: 6 }}>
              {cat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cat.sub}</div>
            <div style={{ fontSize: 10, color: cat.color1, marginTop: 8 }}>CLICK TO VIEW ▸</div>
          </button>
        ))}
      </div>

      {selectedCategory && (
        <Modal
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          title={`Detailed View: ${selectedCategory.toUpperCase()}`}
          width={900}
        >
          <DetailsTable category={selectedCategory} filters={filters} />
        </Modal>
      )}

      {showReadyDetails && (
        <Modal
          isOpen={showReadyDetails}
          onClose={() => setShowReadyDetails(false)}
          title="✅ READY / DAILY OUT DETAILS"
          width={900}
        >
          <DetailsTable category="ready" filters={filters} />
        </Modal>
      )}

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Stage-Wise Item Distribution</div>
          <div className="chart-sub">ITEMS PER PRODUCTION STAGE</div>
          <div className="chart-wrap">
            <canvas ref={stageChartRef} />
          </div>
        </div>
        <div className="chart-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div className="chart-title">Inhouse vs Vendor</div>
            <div className="chart-sub">WORKLOAD SPLIT</div>
            <div className="chart-wrap">
              <canvas ref={donutRef} />
            </div>
          </div>
          <div>
            {/* Kept empty space for Product Category pie chart */}
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">⚠ Bottleneck POs (Highest Lead Time)</div>
        <div className="chart-sub">ORDERED BY STAGE</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {bottlenecks.map((b) => (
            <div
              key={b.stage}
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${b.avgDays > 21 ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '10px 14px',
                minWidth: 140,
              }}
            >
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-muted)' }}>
                {b.stage}
              </div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, color: b.avgDays > 21 ? 'var(--danger)' : 'var(--success)' }}>
                {b.queueSize} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>items</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg: {b.avgDays} days</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Helper Component to fetch and display details in Modal ──
function DetailsTable({ category, filters }) {
  // Translate category into a backend filter
  const fetchFilters = { ...filters };
  if (category === 'ready') {
    fetchFilters.status = 'ready'; // we would need to map this in backend
  } else if (category === 'delayed') {
    // maybe we need a delayed filter param
  }

  // To keep it simple, we just fetch a limited set of data
  const { data: res, isLoading } = useDashboardDataQuery(fetchFilters, 1, 100);
  
  if (isLoading) return <div>Loading details...</div>;

  const rows = res?.data?.rows || [];

  return (
    <VirtualizedTable
      headers={['SC', 'PO', 'PRODUCT', 'STAGE', 'DATE']}
      data={rows}
      height={400}
      RowComponent={({ row }) => (
        <>
          <div style={{ flex: 1, padding: '0 12px' }}>{row.sc}</div>
          <div style={{ flex: 1, padding: '0 12px' }}>{row.po}</div>
          <div style={{ flex: 1, padding: '0 12px' }}>{row.product}</div>
          <div style={{ flex: 1, padding: '0 12px' }}>{row.currentStage}</div>
          <div style={{ flex: 1, padding: '0 12px' }}>{fmtTs(row.timestamp)}</div>
        </>
      )}
      isEmpty={rows.length === 0}
    />
  );
}

export default React.memo(OverviewPage);
