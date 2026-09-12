import React, { useState, useMemo } from 'react';
import { useFilters } from '../context/FilterContext';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import { getStageColor } from '../services/dataNormalizer';
import calculationUtils from '../utils/calculationUtils.js';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';

const {
  daysBetween,
  isSCComplete,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  getSCLastTimestamp,
  normalizeProductsInGroup,
  getProductionDateStatus,
  getTodayIso,
  isDateInNextDays,
} = calculationUtils;

// ─── DATE STATUS BADGE COMPONENT ─────────────────────────────────────────────
function DateStatusBadge({ status, scProdDate }) {
  if (!status || status.code === 'NO_DATE') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            width: 'fit-content',
          }}
        >
          <span style={{ fontSize: 7 }}>●</span> NO DATE
        </span>
        {scProdDate && <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDate(scProdDate)}</span>}
      </div>
    );
  }
  if (status.code === 'OVERDUE') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            width: 'fit-content',
          }}
        >
          <span style={{ fontSize: 7 }}>●</span> OVERDUE
        </span>
        {scProdDate && <span className="mono" style={{ fontSize: 10, color: '#ff3d5a' }}>{fmtDate(scProdDate)}</span>}
      </div>
    );
  }
  if (status.code === 'DUE_TODAY') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            width: 'fit-content',
          }}
        >
          <span style={{ fontSize: 7 }}>●</span> DUE TODAY
        </span>
        {scProdDate && <span className="mono" style={{ fontSize: 10, color: '#ffd60a' }}>{fmtDate(scProdDate)}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
          width: 'fit-content',
        }}
      >
        <span style={{ fontSize: 7 }}>●</span> UPCOMING
      </span>
      {scProdDate && <span className="mono" style={{ fontSize: 10, color: '#00c9ff' }}>{fmtDate(scProdDate)}</span>}
    </div>
  );
}

// ─── STAGE BADGE COMPONENT ────────────────────────────────────────────────────
function StageBadge({ stage }) {
  if (!stage) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const col = getStageColor ? getStageColor(stage) : { bg: 'rgba(0,201,255,0.1)', text: '#00c9ff', border: 'rgba(0,201,255,0.3)' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'Share Tech Mono, monospace',
        background: col.bg || 'rgba(0,201,255,0.1)',
        color: col.text || '#00c9ff',
        border: `1px solid ${col.border || 'rgba(0,201,255,0.3)'}`,
        marginRight: 4,
        marginBottom: 2,
        whiteSpace: 'nowrap',
      }}
    >
      {stage}
    </span>
  );
}

export default function SalesProjectionPage() {
  const { filters } = useFilters();
  const [tab, setTab] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedSC, setSelectedSC] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('sc');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const todayStr = useMemo(
    () => (getTodayIso ? getTodayIso() : new Date().toISOString().substring(0, 10)),
    []
  );

  const { rows: filtered, isLoading } = useProductionDataQuery(filters, 1, 100000);

  // Group items into SC Sets with rich projection metrics
  const scGroups = useMemo(() => {
    const map = {};
    (filtered || []).forEach((r) => {
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

      const stagesList = [...new Set(effectiveItems.map((i) => i.currentStage).filter(Boolean))];
      const productNames = effectiveItems.map((i) => i.product).filter(Boolean);
      const primaryProductName = productNames.length > 0 ? productNames[0] : '—';
      const lastTs = getSCLastTimestamp(effectiveItems);
      const isComplete = isSCComplete(effectiveItems);
      const days = daysBetween(sg.poDate, lastTs || todayStr);

      return {
        ...sg,
        family: scFamily,
        estimatedDelivery,
        items: effectiveItems,
        itemCount: effectiveItems.length,
        primaryProductName,
        productNames,
        stagesList,
        lastTimestamp: lastTs,
        isComplete,
        daysTaken: days,
        scProductionDate,
        productionDateStatus: getProductionDateStatus(scProductionDate, todayStr),
      };
    });
  }, [filtered, todayStr]);

  // Production Date Summary Metrics
  const totalCount = scGroups.length;
  const overdueCount = useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'OVERDUE').length,
    [scGroups]
  );
  const dueTodayCount = useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'DUE_TODAY').length,
    [scGroups]
  );
  const upcomingCount = useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'UPCOMING').length,
    [scGroups]
  );
  const noDateCount = useMemo(
    () => scGroups.filter((g) => g.productionDateStatus.code === 'NO_DATE').length,
    [scGroups]
  );

  // Filtered SC Groups based on tab, date filter, and search
  const displayed = useMemo(() => {
    let list = scGroups.filter((g) => {
      // 1. Completion tab filter
      if (tab === 'complete' && !g.isComplete) return false;
      if (tab === 'wip' && g.isComplete) return false;

      // 2. Production Date filter
      if (dateFilter === 'overdue' && g.productionDateStatus.code !== 'OVERDUE') return false;
      if (dateFilter === 'due_today' && g.productionDateStatus.code !== 'DUE_TODAY') return false;
      if (dateFilter === 'upcoming' && g.productionDateStatus.code !== 'UPCOMING') return false;
      if (dateFilter === 'no_date' && g.productionDateStatus.code !== 'NO_DATE') return false;
      if (dateFilter === 'next7' && (!g.scProductionDate || !isDateInNextDays(g.scProductionDate, 7, todayStr))) return false;
      if (dateFilter === 'next14' && (!g.scProductionDate || !isDateInNextDays(g.scProductionDate, 14, todayStr))) return false;

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchSC = g.sc && g.sc.toLowerCase().includes(q);
        const matchPO = g.po && g.po.toLowerCase().includes(q);
        const matchProduct = g.productNames.some((p) => p.toLowerCase().includes(q));
        const matchStage = g.stagesList.some((s) => s.toLowerCase().includes(q));
        if (!matchSC && !matchPO && !matchProduct && !matchStage) return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];

      if (sortField === 'sc') {
        va = a.sc || '';
        vb = b.sc || '';
      } else if (sortField === 'po') {
        va = a.po || '';
        vb = b.po || '';
      } else if (sortField === 'poDate') {
        va = a.poDate || '';
        vb = b.poDate || '';
      } else if (sortField === 'product') {
        va = a.primaryProductName || '';
        vb = b.primaryProductName || '';
      } else if (sortField === 'items') {
        va = a.itemCount || 0;
        vb = b.itemCount || 0;
      } else if (sortField === 'scProdDate') {
        va = a.scProductionDate || '9999-99-99';
        vb = b.scProductionDate || '9999-99-99';
      } else if (sortField === 'prodDateStatus') {
        va = a.productionDateStatus?.code || '';
        vb = b.productionDateStatus?.code || '';
      } else if (sortField === 'estDelivery') {
        va = a.estimatedDelivery || '';
        vb = b.estimatedDelivery || '';
      } else if (sortField === 'lastTs') {
        va = a.lastTimestamp || '';
        vb = b.lastTimestamp || '';
      } else if (sortField === 'days') {
        va = a.daysTaken ?? -1;
        vb = b.daysTaken ?? -1;
      } else if (sortField === 'status') {
        va = a.isComplete ? 1 : 0;
        vb = b.isComplete ? 1 : 0;
      }

      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [scGroups, tab, dateFilter, search, sortField, sortDir, todayStr]);

  // Pagination slice
  const totalPages = Math.ceil(displayed.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayed.slice(start, start + pageSize);
  }, [displayed, page, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleExpandRow = (sc) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sc)) next.delete(sc);
      else next.add(sc);
      return next;
    });
  };

  const handleExportCSV = () => {
    if (displayed.length === 0) return;
    const headers = [
      'SC No',
      'PO No',
      'PO Date',
      'Item Name',
      'Item Qty',
      'Current Stages',
      'SC Prod Date',
      'Prod Date Status',
      'Estimated Delivery',
      'Last Timestamp',
      'Days Taken',
      'Set Status',
    ];

    const rows = displayed.map((sg) => [
      `"${sg.sc || ''}"`,
      `"${sg.po || ''}"`,
      `"${sg.poDate || ''}"`,
      `"${(sg.productNames || []).join('; ') || sg.primaryProductName || ''}"`,
      sg.itemCount || 0,
      `"${(sg.stagesList || []).join(', ')}"`,
      `"${sg.scProductionDate || ''}"`,
      `"${sg.productionDateStatus?.label || sg.productionDateStatus?.code || ''}"`,
      `"${sg.estimatedDelivery || ''}"`,
      `"${sg.lastTimestamp || ''}"`,
      sg.daysTaken ?? '',
      sg.isComplete ? 'COMPLETE' : 'IN PROGRESS',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Projection_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortHeader = (field, label, style = {}) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        padding: '10px 8px',
        color: sortField === field ? 'var(--accent1, #00c9ff)' : 'var(--text-muted)',
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{label}</span>
        <span style={{ fontSize: '9px', opacity: sortField === field ? 1 : 0.4 }}>
          {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </div>
    </th>
  );

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* SECTION TITLE */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          Sales <span>Projection & Delivery Intelligence</span>
          <div className="section-line" />
        </div>
        <button
          onClick={handleExportCSV}
          className="filter-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Download size={14} color="var(--accent1)" />
          Export Sales Projection
        </button>
      </div>

      {/* KPI STATS GRID ("THIS BOX ALSO") */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
        <KPICard
          label="TOTAL SC SETS"
          value={totalCount}
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

      {/* PRIMARY COMPLETION TABS */}
      <div className="tabs" style={{ marginBottom: 10 }}>
        {[
          ['all', `All Sets (${scGroups.length})`],
          ['complete', `Completed (${scGroups.filter((g) => g.isComplete).length})`],
          ['wip', `In Progress (${scGroups.filter((g) => !g.isComplete).length})`],
        ].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => { setTab(id); setPage(1); }}>
            {label}
          </div>
        ))}
      </div>

      {/* PRODUCTION DATE FILTER SUB-BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          marginBottom: 16,
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono', color: 'var(--text-muted)', marginRight: 4 }}>
          DATE FILTER:
        </span>
        {[
          ['all', 'All Dates'],
          ['overdue', `Overdue (${overdueCount})`],
          ['due_today', `Due Today (${dueTodayCount})`],
          ['next7', 'Next 7 Days'],
          ['next14', 'Next 14 Days'],
          ['upcoming', `Upcoming (${upcomingCount})`],
          ['no_date', `No Date (${noDateCount})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setDateFilter(id); setPage(1); }}
            style={{
              background: dateFilter === id ? 'var(--accent1, #00c9ff)' : 'transparent',
              color: dateFilter === id ? '#000' : 'var(--text-muted)',
              fontWeight: dateFilter === id ? 700 : 500,
              border: dateFilter === id ? '1px solid var(--accent1, #00c9ff)' : '1px solid var(--border)',
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

      {/* MAIN SALES PROJECTION TABLE CARD */}
      <div className="table-card">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="chart-title">Sales Projection — {displayed.length} entries matching</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <input
                className="filter-input"
                placeholder="Search SC / PO / Item / Stage..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{ minWidth: 240, padding: '6px 12px' }}
              />
            </div>
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="filter-btn reset"
                style={{ padding: '6px 10px' }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 30 }}></th>
                {renderSortHeader('sc', 'SC')}
                {renderSortHeader('po', 'PO')}
                {renderSortHeader('poDate', 'PO DATE')}
                {renderSortHeader('product', 'ITEM NAME')}
                {renderSortHeader('items', 'ITEM QTY')}
                <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: '11px' }}>STAGE</th>
                {renderSortHeader('scProdDate', 'SC PROD DATE / STATUS')}
                {renderSortHeader('estDelivery', 'ESTIMATED DELIVERY')}
                {renderSortHeader('lastTs', 'LAST TIMESTAMP')}
                {renderSortHeader('days', 'DAYS TAKEN')}
                {renderSortHeader('status', 'SET STATUS')}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading projection records...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No sales projection records found matching the active filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((sg) => {
                  const isExpanded = expandedRows.has(sg.sc);
                  const done = sg.isComplete;
                  const days = sg.daysTaken;

                  return (
                    <React.Fragment key={sg.sc}>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                          background: isExpanded ? 'rgba(0, 201, 255, 0.03)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) e.currentTarget.style.background = 'var(--bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {/* EXPAND TOGGLE */}
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleExpandRow(sg.sc)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={isExpanded ? 'Collapse items' : 'Expand items'}
                          >
                            {isExpanded ? <ChevronDown size={14} color="var(--accent1)" /> : <ChevronRight size={14} />}
                          </button>
                        </td>

                        {/* SC NO */}
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
                              textAlign: 'left',
                            }}
                            title={`View full details for SC ${sg.sc}`}
                          >
                            {sg.sc}
                          </button>
                        </td>

                        {/* PO NO */}
                        <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sg.po}>
                          {sg.po || '—'}
                        </td>

                        {/* PO DATE */}
                        <td className="mono" style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                          {fmtDate(sg.poDate)}
                        </td>

                        {/* ITEM NAME */}
                        <td style={{ fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sg.productNames.join(', ')}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {sg.primaryProductName}
                          </span>
                          {sg.items.length > 1 && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
                              (+{sg.items.length - 1} more)
                            </span>
                          )}
                        </td>

                        {/* ITEM QTY */}
                        <td style={{ textAlign: 'center', fontFamily: 'Share Tech Mono', fontWeight: 700, fontSize: 12 }}>
                          {sg.itemCount}
                        </td>

                        {/* STAGE */}
                        <td style={{ maxWidth: 180 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {sg.stagesList.length > 0 ? (
                              sg.stagesList.slice(0, 3).map((st, idx) => <StageBadge key={idx} stage={st} />)
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                            {sg.stagesList.length > 3 && (
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', alignSelf: 'center' }}>
                                +{sg.stagesList.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* PROD DATE STATUS & SC PROD DATE */}
                        <td>
                          <DateStatusBadge status={sg.productionDateStatus} scProdDate={sg.scProductionDate} />
                        </td>

                        {/* ESTIMATED DELIVERY */}
                        <td
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: sg.estimatedDelivery ? '#60a5fa' : 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          {formatEstimatedDelivery(sg.estimatedDelivery)}
                        </td>

                        {/* LAST TIMESTAMP */}
                        <td className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {fmtTs(sg.lastTimestamp)}
                        </td>

                        {/* DAYS TAKEN */}
                        <td>
                          <span
                            style={{
                              fontFamily: 'Rajdhani',
                              fontSize: 17,
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

                        {/* SET STATUS */}
                        <td>
                          <span className={`status-pill ${done ? 's-ready' : 's-wip'}`}>
                            {done ? 'COMPLETE' : 'IN PROGRESS'}
                          </span>
                        </td>
                      </tr>

                      {/* EXPANDED INLINE ITEMS ACCORDION */}
                      {isExpanded && (
                        <tr style={{ background: 'rgba(0, 0, 0, 0.15)' }}>
                          <td colSpan="12" style={{ padding: '12px 20px 16px 36px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
                              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--accent1)', fontFamily: 'Share Tech Mono' }}>
                                ↳ Individual Items in SC {sg.sc} ({sg.items.length} total)
                              </div>
                              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>#</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>PRODUCT / ITEM NAME</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>STAGE / PROCESS</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>PROJECTED DATE</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>INHOUSE / VENDOR</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>NEXT OPERATION</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>LAST UPDATE</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sg.items.map((it, idx) => (
                                    <tr key={idx} style={{ borderBottom: idx === sg.items.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '6px 10px', fontFamily: 'Share Tech Mono', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                      <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{it.product || '—'}</td>
                                      <td style={{ padding: '6px 10px' }}><StageBadge stage={it.currentStage} /></td>
                                      <td style={{ padding: '6px 10px', fontFamily: 'Share Tech Mono', color: 'var(--accent1)' }}>{fmtDate(it.projectedDate)}</td>
                                      <td style={{ padding: '6px 10px', color: it.inhouse === 'VENDOR' ? 'var(--accent2)' : 'var(--text-muted)' }}>
                                        {it.inhouse === 'VENDOR' ? 'Vendor' : 'Inhouse'}
                                      </td>
                                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{it.status2 || '—'}</td>
                                      <td style={{ padding: '6px 10px', fontFamily: 'Share Tech Mono', color: 'var(--text-muted)' }}>{fmtTs(it.timestamp)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, displayed.length)} of {displayed.length} entries
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="filter-btn"
                style={{ padding: '4px 10px', opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--text-primary)', padding: '0 4px' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="filter-btn"
                style={{ padding: '4px 10px', opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED SC MODAL */}
      {selectedSC && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSC(null)}
          title={`SC ${selectedSC.sc} — Sales Projection & Process Breakdown`}
          maxWidth="90%"
        >
          <div style={{ padding: '5px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>Purchase Order</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{selectedSC.po || '—'}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>PO Date</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Share Tech Mono', color: 'var(--accent1)', marginTop: 2 }}>{fmtDate(selectedSC.poDate)}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>SC Production Date</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Share Tech Mono', color: '#00c9ff', marginTop: 2 }}>{fmtDate(selectedSC.scProductionDate)}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>Estimated Delivery (SLA)</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Share Tech Mono', color: '#60a5fa', marginTop: 2 }}>{formatEstimatedDelivery(selectedSC.estimatedDelivery)}</div>
              </div>
            </div>

            <DataTable
              headers={['#', 'Product', 'Stage', 'Projected Date', 'Status', 'Inhouse/Vendor', 'Move To', 'Last Update']}
              isEmpty={!selectedSC.items || selectedSC.items.length === 0}
            >
              {selectedSC.items.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{it.product || '—'}</td>
                  <td style={{ padding: '10px 8px' }}><StageBadge stage={it.currentStage} /></td>
                  <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: 'var(--accent1)' }}>{fmtDate(it.projectedDate)}</td>
                  <td style={{ padding: '10px 8px' }}><DateStatusBadge status={getProductionDateStatus(it.projectedDate, todayStr)} /></td>
                  <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', color: it.inhouse === 'VENDOR' ? 'var(--accent2)' : 'var(--text-primary)' }}>
                    {it.inhouse === 'VENDOR' ? 'Vendor' : 'Inhouse'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{it.status2 || '—'}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-muted)' }}>{fmtTs(it.timestamp)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Modal>
      )}
    </div>
  );
}
