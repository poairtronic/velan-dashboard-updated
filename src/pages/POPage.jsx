import React, { useState, useMemo, useEffect } from 'react';
import { usePoGroupsQuery, useBottlenecksQuery } from '../hooks/queries/useDashboardQueries';
import { useFilters } from '../context/FilterContext';
import { useUI } from '../context/UIContext';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import { daysBetween } from '../utils/calculationUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import VirtualizedTable from '../components/ui/VirtualizedTable';
import useChart from '../utils/chartUtils';
import { LoadingScreen } from '../components/LoadingScreen';

function POPage() {
  const { filters } = useFilters();
  const { selectedPONum, setSelectedPONum } = useUI();
  const { data: poData, isLoading: isPoLoading } = usePoGroupsQuery(filters);
  const { data: bottleneckData } = useBottlenecksQuery(filters);

  const [tab, setTab] = useState('all');
  const [selectedPO, setSelectedPO] = useState(null);
  const [search, setSearch] = useState('');
  const leadsRef = React.useRef();

  const poGroups = poData || [];
  const bottlenecks = bottleneckData?.data?.bottlenecks || [];

  useEffect(() => {
    if (selectedPONum && poGroups.length > 0) {
      const found = poGroups.find((p) => p.po === selectedPONum);
      if (found) {
        setSelectedPO(found);
        setSelectedPONum(null);
      }
    }
  }, [selectedPONum, poGroups, setSelectedPONum]);

  const tabFiltered =
    tab === 'complete'
      ? poGroups.filter((p) => p.done)
      : tab === 'wip'
        ? poGroups.filter((p) => !p.done)
        : poGroups;

  const displayed = search.trim()
    ? tabFiltered.filter((p) => String(p.po || '').toLowerCase().includes(search.trim().toLowerCase()))
    : tabFiltered;

  const completePOs = poGroups.filter((p) => p.done).length;
  const inProgressPOs = poGroups.length - completePOs;

  const leadData = useMemo(() => bottlenecks.slice(0, 15), [bottlenecks]);

  useChart(
    leadsRef,
    {
      type: 'bar',
      data: {
        labels: leadData.map((b) => (b.po.length > 12 ? b.po.substring(0, 12) + '…' : b.po)),
        datasets: [
          {
            label: 'Days',
            data: leadData.map((b) => b.avgDays || 0),
            backgroundColor: leadData.map((b) => ((b.avgDays || 0) > 21 ? '#ff3d5a99' : '#00e67699')),
            borderColor: leadData.map((b) => ((b.avgDays || 0) > 21 ? '#ff3d5a' : '#00e676')),
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
          tooltip: { callbacks: { label: (c) => `${c.parsed.y} days` } },
        },
        scales: {
          x: { ticks: { color: '#7ba7cc', font: { size: 9 } }, grid: { color: 'rgba(26,58,92,0.3)' } },
          y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' }, title: { display: true, text: 'Days', color: '#7ba7cc' } },
        },
      },
    },
    [leadData]
  );

  if (isPoLoading) {
    return <div style={{ padding: 40, color: '#fff' }}>Loading PO Sets...</div>;
  }

  return (
    <div>
      <div className="section-title">
        PO <span>Analysis</span>
        <div className="section-line" />
      </div>

      <div className="kpi-grid">
        <KPICard
          label="TOTAL POs"
          value={poGroups.length}
          sub="purchase orders"
          color1="#00c9ff"
          color2="#0fa8e0"
        />
        <KPICard
          label="COMPLETE POs"
          value={completePOs}
          sub="all SC sets ready"
          color1="#00e676"
          color2="#00c9ff"
        />
        <KPICard
          label="IN-PROGRESS POs"
          value={inProgressPOs}
          sub="awaiting completion"
          color1="#ffd60a"
          color2="#ff6b35"
        />
        <KPICard
          label="TARGET"
          value="21 days"
          sub="3 weeks delivery target"
          color1="#ffd60a"
          color2="#ff6b35"
        />
      </div>

      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div className="chart-title">Lead Time per PO — Bottleneck Chart</div>
        <div className="chart-sub">RED = EXCEEDED 21 DAYS · GREEN = ON TIME</div>
        <div className="chart-wrap-lg">
          <canvas ref={leadsRef} />
        </div>
      </div>

      <div className="tabs">
        {[
          ['all', 'All POs'],
          ['complete', 'Completed'],
          ['wip', 'In Progress'],
        ].map(([id, label]) => (
          <div
            key={id}
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => {
              setTab(id);
              setSelectedPO(null);
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="chart-title">PO Sets — {displayed.length} entries</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input
              className="filter-input"
              placeholder="Search PO..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedPO(null);
              }}
              style={{ minWidth: 220, padding: '5px 12px' }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedPO(null);
                }}
                className="filter-btn reset"
                style={{ padding: '5px 10px' }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
        
        <VirtualizedTable
          headers={['PO', 'PO DATE', 'SCs COUNT', 'ITEMS COUNT', 'STATUS']}
          data={displayed}
          height={500}
          RowComponent={({ row }) => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const isDelayed = !row.done && (daysBetween(row.poDate, todayStr) > 21);
            return (
              <>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <button
                    onClick={() => setSelectedPO(row)}
                    className="mono text-accent fw7"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
                  >
                    {row.po}
                  </button>
                </div>
                <div style={{ flex: 1, padding: '0 12px', fontSize: 11 }} className="mono">{fmtDate(row.poDate)}</div>
                <div style={{ flex: 1, padding: '0 12px', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, color: 'var(--text-muted)' }}>
                  {row.scCount}
                </div>
                <div style={{ flex: 1, padding: '0 12px', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15 }}>
                  {row.itemsLength}
                </div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span className={`status-pill ${row.done ? 's-ready' : 's-wip'}`}>
                    {row.done ? 'COMPLETE' : 'IN PROGRESS'}
                  </span>
                </div>
              </>
            );
          }}
          isEmpty={displayed.length === 0}
        />
      </div>

      {selectedPO && (
        <Modal
          isOpen={!!selectedPO}
          onClose={() => setSelectedPO(null)}
          title={`PO ${selectedPO.po} — Details`}
          width={800}
        >
          <div style={{ padding: 20 }}>
            <h3>Details for PO {selectedPO.po} are now fetched natively through individual item views or database search.</h3>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default React.memo(POPage);
