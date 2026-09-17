import React from 'react';
import { useFilters } from '../context/FilterContext';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import { getStageColor } from '../services/dataNormalizer';
import {
  daysBetween,
  calculateProcessCycleTime,
  isSCComplete,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  getSCLastTimestamp,
  normalizeProductsInGroup,
  getProductionDateStatus,
  getTodayIso,
  isDateInNextDays,
} from '../utils/calculationUtils.js';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import useChart from '../utils/chartUtils';
import TableExportDropdown from '../components/TableExportDropdown';

// ─── DATE STATUS BADGE COMPONENT ─────────────────────────────────────────────
function DateStatusBadge({ status }) {
  if (!status || status.code === 'NO_DATE') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'Share Tech Mono, monospace',
          background: 'rgba(123, 167, 204, 0.12)',
          color: 'var(--text-muted, #7ba7cc)',
          border: '1px solid rgba(123, 167, 204, 0.25)',
        }}
      >
        <span style={{ fontSize: 7 }}>●</span> NO DATE
      </span>
    );
  }
  if (status.code === 'OVERDUE') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'Share Tech Mono, monospace',
          background: 'rgba(255, 61, 90, 0.15)',
          color: '#ff3d5a',
          border: '1px solid rgba(255, 61, 90, 0.35)',
        }}
      >
        <span style={{ fontSize: 7 }}>●</span> OVERDUE
      </span>
    );
  }
  if (status.code === 'DUE_TODAY') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'Share Tech Mono, monospace',
          background: 'rgba(255, 214, 10, 0.15)',
          color: '#ffd60a',
          border: '1px solid rgba(255, 214, 10, 0.35)',
        }}
      >
        <span style={{ fontSize: 7 }}>●</span> DUE TODAY
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        fontFamily: 'Share Tech Mono, monospace',
        background: 'rgba(0, 201, 255, 0.15)',
        color: '#00c9ff',
        border: '1px solid rgba(0, 201, 255, 0.35)',
      }}
    >
      <span style={{ fontSize: 7 }}>●</span> UPCOMING
    </span>
  );
}

// ─── SC COMPONENT SET COMPLETION & ANALYTICS PAGE ─────────────────────────────
function SCPage() {

  const { filters } = useFilters();
  const [tab, setTab] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('all');
  const [selectedSC, setSelectedSC] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [sortField, setSortField] = React.useState('sc');
  const [sortDir, setSortDir] = React.useState('asc');
  const distChartRef = React.useRef(null);
  const scTableRef = React.useRef(null);
  const childTableRef = React.useRef(null);

  const todayStr = React.useMemo(
    () => (getTodayIso ? getTodayIso() : new Date().toISOString().substring(0, 10)),
    []
  );

  const { rows: filtered } = useProductionDataQuery(filters, 1, 10000);

  const scGroups = React.useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      if (!r.sc) return;
      if (!map[r.sc]) {
        map[r.sc] = {
          sc: r.sc,
          po: r.po,
          poDate: r.poDate,
          family: r.family || r.type,
          estimatedDelivery: r.estimatedDelivery || calculateEstimatedDelivery(r.poDate, r.family || r.type),
          items: [],
        };
      }
      map[r.sc].items.push(r);
    });
    return Object.values(map).map((sg) => {
      const latestMap = {};
      const normalized = normalizeProductsInGroup ? normalizeProductsInGroup(sg.items) : sg.items;
      normalized.forEach((r) => {
        const key = (r.product || '__none__').trim();
        const ex = latestMap[key];
        if (!ex) {
          latestMap[key] = r;
          return;
        }
        if (r._isLive && !ex._isLive) {
          latestMap[key] = r;
          return;
        }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
      });
      const effectiveItems = Object.values(latestMap);
      const scFamily =
        effectiveItems.find((it) => it.family || it.type)?.family ||
        effectiveItems.find((it) => it.family || it.type)?.type ||
        sg.family;
      const scProductionDate = calculateSCProductionDate(effectiveItems, todayStr);
      const estimatedDelivery =
        sg.estimatedDelivery || calculateEstimatedDelivery(sg.poDate, scFamily);
      return {
        ...sg,
        family: scFamily,
        estimatedDelivery,
        items: effectiveItems,
        scProductionDate,
        productionDateStatus: getProductionDateStatus(scProductionDate, todayStr),
      };
    });
  }, [filtered, todayStr]);

  // Production Date Summary Metrics (Reconciled: Total = Upcoming + Due Today + Overdue + No Date)
  const overdueCount = React.useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'OVERDUE').length,
    [scGroups]
  );
  const dueTodayCount = React.useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'DUE_TODAY').length,
    [scGroups]
  );
  const upcomingCount = React.useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'UPCOMING').length,
    [scGroups]
  );
  const noDateCount = React.useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'NO_DATE').length,
    [scGroups]
  );

  // Distribution Chart Data
  const chartData = React.useMemo(() => {
    const dateCountMap = {};
    scGroups.forEach((g) => {
      if (g.scProductionDate) {
        dateCountMap[g.scProductionDate] = (dateCountMap[g.scProductionDate] || 0) + 1;
      }
    });
    const sortedDates = Object.keys(dateCountMap).sort();
    return {
      labels: sortedDates.map((d) => fmtDate(d)),
      datasets: [
        {
          label: 'SC Sets',
          data: sortedDates.map((d) => dateCountMap[d]),
          backgroundColor: sortedDates.map((d) => {
            const st = getProductionDateStatus(d, todayStr).code;
            if (st === 'OVERDUE') return '#ff3d5acc';
            if (st === 'DUE_TODAY') return '#ffd60acc';
            return '#00c9ffcc';
          }),
          borderColor: sortedDates.map((d) => {
            const st = getProductionDateStatus(d, todayStr).code;
            if (st === 'OVERDUE') return '#ff3d5a';
            if (st === 'DUE_TODAY') return '#ffd60a';
            return '#00c9ff';
          }),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [scGroups, todayStr]);

  useChart(
    distChartRef,
    {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.parsed.y} SC Sets scheduled`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(26,58,92,0.2)' },
            ticks: { font: { size: 10, family: 'Share Tech Mono' } },
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10, family: 'Share Tech Mono' } },
            grid: { color: 'rgba(26,58,92,0.2)' },
          },
        },
      },
    },
    [chartData]
  );

  const tabFiltered =
    tab === 'complete'
      ? scGroups.filter((g) => isSCComplete(g.items))
      : tab === 'wip'
        ? scGroups.filter((g) => !isSCComplete(g.items))
        : scGroups;

  const dateFiltered = React.useMemo(() => {
    if (dateFilter === 'all') return tabFiltered;
    return tabFiltered.filter((sg) => {
      const status = sg.productionDateStatus;
      if (dateFilter === 'overdue') return status.code === 'OVERDUE';
      if (dateFilter === 'today') return status.code === 'DUE_TODAY';
      if (dateFilter === 'upcoming') return status.code === 'UPCOMING';
      if (dateFilter === 'nodate') return status.code === 'NO_DATE';
      if (dateFilter === 'next7') return isDateInNextDays(sg.scProductionDate, 7, todayStr);
      if (dateFilter === 'next14') return isDateInNextDays(sg.scProductionDate, 14, todayStr);
      return true;
    });
  }, [tabFiltered, dateFilter, todayStr]);

  const searched = search.trim()
    ? dateFiltered.filter((sg) => {
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
    : dateFiltered;

  const displayed = React.useMemo(() => {
    const sorted = [...searched];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'sc') {
        cmp = String(a.sc || '').localeCompare(String(b.sc || ''), undefined, { numeric: true });
      } else if (sortField === 'po') {
        cmp = String(a.po || '').localeCompare(String(b.po || ''), undefined, { numeric: true });
      } else if (sortField === 'poDate') {
        const da = a.poDate ? new Date(a.poDate).getTime() : null;
        const db = b.poDate ? new Date(b.poDate).getTime() : null;
        if (da === null && db === null) cmp = 0;
        else if (da === null) return 1;
        else if (db === null) return -1;
        else cmp = da - db;
      } else if (sortField === 'items') {
        cmp = (a.items?.length || 0) - (b.items?.length || 0);
      } else if (sortField === 'scProdDate') {
        const da = a.scProductionDate ? new Date(a.scProductionDate).getTime() : null;
        const db = b.scProductionDate ? new Date(b.scProductionDate).getTime() : null;
        if (da === null && db === null) cmp = 0;
        else if (da === null) return 1;
        else if (db === null) return -1;
        else cmp = da - db;
      } else if (sortField === 'prodDateStatus') {
        const statusOrder = { OVERDUE: 1, DUE_TODAY: 2, UPCOMING: 3, NO_DATE: 4 };
        const rankA = statusOrder[a.productionDateStatus?.code] || 99;
        const rankB = statusOrder[b.productionDateStatus?.code] || 99;
        cmp = rankA - rankB;
      } else if (sortField === 'estDelivery') {
        const parseEstDate = (val) => {
          if (!val) return null;
          if (typeof val === 'string') return new Date(val).getTime();
          if (val.startDate) return new Date(val.startDate).getTime();
          if (val.date) return new Date(val.date).getTime();
          return null;
        };
        const da = parseEstDate(a.estimatedDelivery);
        const db = parseEstDate(b.estimatedDelivery);
        if (da === null && db === null) cmp = 0;
        else if (da === null) return 1;
        else if (db === null) return -1;
        else cmp = da - db;
      } else if (sortField === 'lastTs') {
        const aTs = getSCLastTimestamp(a.items);
        const bTs = getSCLastTimestamp(b.items);
        const da = aTs ? new Date(aTs).getTime() : null;
        const db = bTs ? new Date(bTs).getTime() : null;
        if (da === null && db === null) cmp = 0;
        else if (da === null) return 1;
        else if (db === null) return -1;
        else cmp = da - db;
      } else if (sortField === 'days') {
        const da = daysBetween(a.poDate, getSCLastTimestamp(a.items));
        const db = daysBetween(b.poDate, getSCLastTimestamp(b.items));
        if (da === null && db === null) cmp = 0;
        else if (da === null) return 1;
        else if (db === null) return -1;
        else cmp = da - db;
      } else if (sortField === 'status') {
        const aDone = isSCComplete(a.items);
        const bDone = isSCComplete(b.items);
        cmp = aDone === bDone ? 0 : aDone ? -1 : 1;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [searched, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const renderSortHeader = (field, label) => (
    <th
      onClick={() => handleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      title={`Sort by ${label}`}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span>{label}</span>
        <span style={{ fontSize: 9, opacity: sortField === field ? 1 : 0.35 }}>
          {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </div>
    </th>
  );

  return (
    <div>
      <div className="section-title">
        SC Sets <span>Production Analytics</span>
        <div className="section-line" />
      </div>

      {/* Production Date Analytics KPI Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <KPICard
          label="TOTAL SC SETS"
          value={scGroups.length}
          sub="unique job sets"
          color1="#00c9ff"
          color2="#0fa8e0"
        />
        <KPICard
          label="UPCOMING"
          value={upcomingCount}
          sub="production date > today"
          color1="#00e676"
          color2="#00c9ff"
        />
        <KPICard
          label="DUE TODAY"
          value={dueTodayCount}
          sub="production date = today"
          color1="#ffd60a"
          color2="#ff9e00"
        />
        <KPICard
          label="OVERDUE"
          value={overdueCount}
          sub="production date < today"
          color1="#ff3d5a"
          color2="#e60026"
        />
        <KPICard
          label="NO DATE"
          value={noDateCount}
          sub="missing projected date"
          color1="#7ba7cc"
          color2="#455f7b"
        />
      </div>

      {/* Production Date Schedule & Distribution Chart */}
      {chartData.labels.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-title">SC Production Schedule & Date Distribution</div>
          <div className="chart-sub">
            DISTRIBUTION OF SC SETS BY PROJECTED MANUFACTURING COMPLETION DATE · RED = OVERDUE · YELLOW = DUE TODAY · CYAN = UPCOMING
          </div>
          <div className="chart-wrap" style={{ height: 180 }}>
            <canvas ref={distChartRef} />
          </div>
        </div>
      )}

      {/* Primary Completion Tabs */}
      <div className="tabs" style={{ marginBottom: 8 }}>
        {[
          ['all', `All Sets (${scGroups.length})`],
          ['complete', `Completed (${scGroups.filter((g) => isSCComplete(g.items)).length})`],
          ['wip', `In Progress (${scGroups.filter((g) => !isSCComplete(g.items)).length})`],
        ].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </div>
        ))}
      </div>

      {/* Production Date Filter Sub-Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          marginBottom: 14,
          padding: '6px 10px',
          background: 'rgba(26,58,92,0.2)',
          borderRadius: 6,
          border: '1px solid rgba(26,58,92,0.3)',
        }}
      >
        <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono', color: 'var(--text-muted)', marginRight: 4 }}>
          DATE FILTER:
        </span>
        {[
          ['all', 'All Dates'],
          ['overdue', `Overdue (${overdueCount})`],
          ['today', `Due Today (${dueTodayCount})`],
          ['next7', 'Next 7 Days'],
          ['next14', 'Next 14 Days'],
          ['upcoming', `Upcoming (${upcomingCount})`],
          ['nodate', `No Date (${noDateCount})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setDateFilter(id)}
            style={{
              background: dateFilter === id ? 'var(--accent1, #00c9ff)' : 'rgba(10,25,47,0.6)',
              color: dateFilter === id ? '#000' : 'var(--text-muted)',
              fontWeight: dateFilter === id ? 700 : 500,
              border: dateFilter === id ? '1px solid var(--accent1, #00c9ff)' : '1px solid rgba(26,58,92,0.4)',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10,
              fontFamily: 'Share Tech Mono, monospace',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main SC Sets Table */}
      <div className="table-card">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="chart-title">SC Sets — {displayed.length} entries shown</div>
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
            <TableExportDropdown title="SC Sets Overview" tableRef={scTableRef} />
          </div>
        </div>
        <div className="table-wrap">
          <table ref={scTableRef}>
            <thead>
              <tr>
                {renderSortHeader('sc', 'SC NO')}
                {renderSortHeader('po', 'PO')}
                {renderSortHeader('poDate', 'PO DATE')}
                {renderSortHeader('items', 'ITEMS')}
                {renderSortHeader('scProdDate', 'SC PROD DATE')}
                {renderSortHeader('prodDateStatus', 'PROD DATE STATUS')}
                {renderSortHeader('estDelivery', 'ESTIMATED DELIVERY')}
                {renderSortHeader('lastTs', 'LAST TIMESTAMP')}
                {renderSortHeader('days', 'DAYS TAKEN')}
                {renderSortHeader('status', 'SET STATUS')}
              </tr>
            </thead>
            <tbody>
              {displayed.map((sg, i) => {
                const done = isSCComplete(sg.items);
                const lastTs = getSCLastTimestamp(sg.items);
                const scProdDate = sg.scProductionDate;
                const dateStatus = sg.productionDateStatus;
                const estDelivery = sg.estimatedDelivery || calculateEstimatedDelivery(sg.poDate, sg.family);
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
                    <td
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: scProdDate ? 'var(--accent1, #00c9ff)' : 'var(--text-muted)',
                      }}
                    >
                      {fmtDate(scProdDate)}
                    </td>
                    <td>
                      <DateStatusBadge status={dateStatus} />
                    </td>
                    <td
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: estDelivery ? '#60a5fa' : 'var(--text-muted)',
                      }}
                    >
                      {formatEstimatedDelivery(estDelivery)}
                    </td>
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

      {/* Child Product Details Drill-Down Table */}
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
                PO: {selectedSC.po} · {selectedSC.items.length} items in this SC · SC PROD DATE: {fmtDate(selectedSC.scProductionDate)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TableExportDropdown title={`SC ${selectedSC.sc} Product Details`} tableRef={childTableRef} />
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
          </div>
          <div className="table-wrap">
            <table ref={childTableRef}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>PRODUCT</th>
                  <th>CURRENT PROCESS</th>
                  <th>PROJECTED DATE</th>
                  <th>DATE STATUS</th>
                  <th>ESTIMATED DELIVERY</th>
                  <th>STATUS 1</th>
                  <th>INHOUSE/VENDOR</th>
                  <th>LAST UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {selectedSC.items.map((item, idx) => {
                  const estDeliv =
                    item.estimatedDelivery ||
                    calculateEstimatedDelivery(
                      selectedSC.poDate || item.poDate,
                      item.family || item.type || selectedSC.family
                    );
                  const prodDateStatus = getProductionDateStatus(item.projectedDate, todayStr);
                  return (
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
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: item.projectedDate ? 'var(--accent1, #00c9ff)' : 'var(--text-muted)',
                        }}
                      >
                        {fmtDate(item.projectedDate)}
                      </td>
                      <td>
                        <DateStatusBadge status={prodDateStatus} />
                      </td>
                      <td
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: estDeliv ? '#60a5fa' : 'var(--text-muted)',
                        }}
                      >
                        {formatEstimatedDelivery(estDeliv)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SCPage;
