import React, { useState } from 'react';
import { useScGroupsQuery } from '../hooks/queries/useDashboardQueries';
import { useFilters } from '../context/FilterContext';
import { getStageColor } from '../services/dataNormalizer';
import { daysBetween } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import VirtualizedTable from '../components/ui/VirtualizedTable';
import { LoadingScreen } from '../components/LoadingScreen';

function SCPage() {
  const { filters } = useFilters();
  const { data: scData, isLoading } = useScGroupsQuery(filters);
  const [tab, setTab] = useState('all');
  const [selectedSC, setSelectedSC] = useState(null);
  const [search, setSearch] = useState('');

  const scGroups = scData || [];

  const tabFiltered =
    tab === 'complete'
      ? scGroups.filter((g) => g.done)
      : tab === 'wip'
        ? scGroups.filter((g) => !g.done)
        : scGroups;

  const displayed = search.trim()
    ? tabFiltered.filter((sg) => {
        const s = search.trim().toLowerCase();
        return (
          String(sg.sc || '').toLowerCase().includes(s) ||
          String(sg.po || '').toLowerCase().includes(s)
        );
      })
    : tabFiltered;

  if (isLoading) {
    return <div style={{ padding: 40, color: '#fff' }}>Loading SC Sets...</div>;
  }

  const completeSets = scGroups.filter(g => g.done).length;

  return (
    <div>
      <div className="section-title">
        SC Sets <span>Completion</span>
        <div className="section-line" />
      </div>

      <div className="kpi-grid">
        <KPICard
          label="TOTAL SC SETS"
          value={scGroups.length}
          sub="unique job sets"
          color1="#00c9ff"
          color2="#0fa8e0"
        />
        <KPICard
          label="COMPLETE SETS"
          value={completeSets}
          sub="all items ready/stores"
          color1="#00e676"
          color2="#00c9ff"
        />
        <KPICard
          label="IN-PROGRESS SETS"
          value={scGroups.length - completeSets}
          sub="awaiting completion"
          color1="#ffd60a"
          color2="#ff6b35"
        />
      </div>

      <div className="tabs">
        {[
          ['all', 'All Sets'],
          ['complete', 'Completed'],
          ['wip', 'In Progress'],
        ].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="chart-title">SC Sets — {displayed.length} entries</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input
              className="filter-input"
              placeholder="Search SC / PO..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedSC(null);
              }}
              style={{ minWidth: 220, padding: '5px 12px' }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedSC(null);
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
          headers={['SC NO', 'PO', 'PO DATE', 'ITEMS', 'LAST TIMESTAMP', 'DAYS TAKEN', 'SET STATUS']}
          data={displayed}
          height={600}
          RowComponent={({ row }) => {
            const days = daysBetween(row.poDate, row.lastTs);
            return (
              <>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <button
                    onClick={() => setSelectedSC(row)}
                    className="mono text-accent fw7"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
                  >
                    {row.sc}
                  </button>
                </div>
                <div style={{ flex: 1, padding: '0 12px', fontSize: 11 }}>{row.po}</div>
                <div style={{ flex: 1, padding: '0 12px', fontSize: 11 }} className="mono">{fmtDate(row.poDate)}</div>
                <div style={{ flex: 1, padding: '0 12px' }}>{row.itemsLength}</div>
                <div style={{ flex: 1, padding: '0 12px', fontSize: 10 }} className="mono">{fmtTs(row.lastTs)}</div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: row.done && days != null && days > 21 ? 'var(--danger)' : row.done ? 'var(--success)' : 'var(--warning)' }}>
                    {days ?? '—'}
                  </span>
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

      {selectedSC && (
        <Modal
          isOpen={!!selectedSC}
          onClose={() => setSelectedSC(null)}
          title={`SC ${selectedSC.sc} — Details`}
          width={800}
        >
          <div style={{ padding: 20 }}>
            <h3>Details for SC {selectedSC.sc} are now fetched natively through individual item views or database search.</h3>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SCPage;
