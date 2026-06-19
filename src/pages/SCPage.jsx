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
// ─── SC COMPONENT SET COMPLETION PAGE COMPONENT ───────────────────────────────

function SCPage() {
  const { kpis } = useData();
  const { filters } = useFilters();
  const [tab, setTab] = React.useState('all');
  const [selectedSC, setSelectedSC] = React.useState(null);
  const [search, setSearch] = React.useState('');

  const { rows: filtered } = useProductionDataQuery(filters, 1, 10000);

  const scGroups = React.useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      if (!r.sc) return;
      if (!map[r.sc]) map[r.sc] = { sc: r.sc, po: r.po, poDate: r.poDate, items: [] };
      map[r.sc].items.push(r);
    });
    return Object.values(map);
  }, [filtered]);

  const tabFiltered =
    tab === 'complete'
      ? scGroups.filter((g) => isSCComplete(g.items))
      : tab === 'wip'
        ? scGroups.filter((g) => !isSCComplete(g.items))
        : scGroups;

  const displayed = search.trim()
    ? tabFiltered.filter((sg) => {
        const s = search.trim().toLowerCase();
        return (
          String(sg.sc || '')
            .toLowerCase()
            .includes(s) ||
          String(sg.po || '')
            .toLowerCase()
            .includes(s) ||
          sg.items.some((item) =>
            String(item.product || '')
              .toLowerCase()
              .includes(s)
          )
        );
      })
    : tabFiltered;

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
          value={scGroups.filter((g) => isSCComplete(g.items)).length}
          sub="all items ready/stores"
          color1="#00e676"
          color2="#00c9ff"
        />
        <KPICard
          label="IN-PROGRESS SETS"
          value={scGroups.filter((g) => !isSCComplete(g.items)).length}
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
              placeholder="Search SC / PO / Product..."
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SC NO</th>
                <th>PO</th>
                <th>PO DATE</th>
                <th>ITEMS</th>
                <th>LAST TIMESTAMP</th>
                <th>DAYS TAKEN</th>
                <th>SET STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((sg, i) => {
                const done = isSCComplete(sg.items);
                const lastTs = getSCLastTimestamp(sg.items);
                const days = daysBetween(sg.poDate, lastTs);
                return (
                  <tr key={i}>
                    <td>
                      <button
                        onClick={() => setSelectedSC(sg)}
                        className="mono text-accent fw7"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontSize: 13,
                        }}
                        title={`View products for SC ${sg.sc}`}
                      >
                        {sg.sc}
                      </button>
                    </td>
                    <td style={{ fontSize: 11 }}>{sg.po}</td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {fmtDate(sg.poDate)}
                    </td>
                    <td>{sg.items.length}</td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {fmtTs(lastTs)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 18,
                          fontWeight: 700,
                          color:
                            done && days != null && days > 21
                              ? 'var(--danger)'
                              : done
                                ? 'var(--success)'
                                : 'var(--warning)',
                        }}
                      >
                        {days ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${done ? 's-ready' : 's-wip'}`}>
                        {done ? 'COMPLETE' : 'IN PROGRESS'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSC && (
        <div className="table-card" style={{ marginTop: 16 }}>
          <div
            className="table-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <div className="chart-title">SC {selectedSC.sc} — Product & Process Details</div>
              <div className="chart-sub">
                PO: {selectedSC.po} · {selectedSC.items.length} items in this SC
              </div>
            </div>
            <button
              onClick={() => setSelectedSC(null)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              CLOSE
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>PRODUCT</th>
                  <th>CURRENT PROCESS</th>
                  <th>STATUS 1</th>
                  <th>INHOUSE/VENDOR</th>
                  <th>LAST UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {selectedSC.items.map((item, idx) => (
                  <tr key={`${selectedSC.sc}-${idx}`}>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 16,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.product || '—'}
                    </td>
                    <td>
                      <span
                        className="status-pill"
                        style={{
                          background: getStageColor(item.currentStage) + '22',
                          color: getStageColor(item.currentStage),
                        }}
                      >
                        {item.currentStage || '—'}
                      </span>
                    </td>
                    <td
                      style={{
                        fontSize: 10,
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.status1 || '—'}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${item.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}
                      >
                        {item.inhouse || 'INHOUSE'}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {fmtTs(item.timestamp)}
                    </td>
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

export default SCPage;
