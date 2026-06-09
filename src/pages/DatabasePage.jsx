import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../hooks/useAuth';
import { getStageColor } from '../services/dataNormalizer';
import { workingDaysBetween, daysBetween, calculateProcessCycleTime, isSCComplete, getSCLastTimestamp, getProductCategory, normalizeProductsInGroup } from '../utils/calculationUtils';
import { fmtTs, fmtDate } from '../utils/dateUtils';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { parseRawCsv, parseWorksheet } from '../services/excelParser';
// ─── DATABASE PAGE COMPONENT ──────────────────────────────────────────────────

function DatabasePage() {
  const { isAdmin } = useAuth();
  const {
    allDbData: rawData,
    data: historyRows,
    historyConfig,
    setHistoryConfig,
    syncHistorySheet: onSyncHistory,
    importState,
    resetDB: onResetDB,
    handleHistoryFileUpload,
    handleHistoryDragDrop,
  } = useDashboard();

  const data = React.useMemo(() => {
    if (!rawData) return [];
    const scGroups = {};
    rawData.forEach(r => {
      if (!r.sc) return;
      if (!scGroups[r.sc]) scGroups[r.sc] = [];
      scGroups[r.sc].push(r);
    });
    const activeRows = [];
    rawData.forEach(r => {
      if (!r.sc) {
        activeRows.push(r);
        return;
      }
      const group = scGroups[r.sc] || [];
      const liveRows = group.filter(row => row._isLive);
      let activePOs = [];
      let activeProducts = [];
      if (liveRows.length > 0) {
        activePOs = [...new Set(liveRows.map(row => row.po).filter(Boolean))];
        const normalizedLive = normalizeProductsInGroup(liveRows);
        activeProducts = [...new Set(normalizedLive.map(row => (row.product || '').trim()).filter(Boolean))];
      } else {
        const sorted = [...group].sort((a, b) => {
          const tA = a.timestamp || a.poDate || '';
          const tB = b.timestamp || b.poDate || '';
          return tB.localeCompare(tA);
        });
        if (sorted[0] && sorted[0].po) {
          activePOs = [sorted[0].po];
        }
      }
      if (!activePOs.includes(r.po)) return;
      if (liveRows.length > 0 && activeProducts.length > 0) {
        const cleanProduct = (r.product || '').trim();
        let productMatch = activeProducts.includes(cleanProduct);
        if (!productMatch) {
          if (cleanProduct.endsWith('...')) {
            const prefix = cleanProduct.slice(0, -3);
            productMatch = activeProducts.some(ap => ap.startsWith(prefix));
          } else {
            productMatch = activeProducts.some(ap => ap.endsWith('...') && cleanProduct.startsWith(ap.slice(0, -3)));
          }
        }
        if (!productMatch) return;
      } else if (liveRows.length === 0) {
        const activeGroupRows = group.filter(row => activePOs.includes(row.po));
        const scTimestamps = activeGroupRows.map(row => row.timestamp).filter(Boolean);
        if (scTimestamps.length > 0) {
          const latestSCTime = new Date(scTimestamps.sort().pop()).getTime();
          const prodRows = activeGroupRows.filter(row => (row.product || '').trim() === (r.product || '').trim());
          const prodTimestamps = prodRows.map(row => row.timestamp).filter(Boolean);
          if (prodTimestamps.length > 0) {
            const latestProdTime = new Date(prodTimestamps.sort().pop()).getTime();
            const diffDays = (latestSCTime - latestProdTime) / (1000 * 60 * 60 * 24);
            if (diffDays > 3) {
              return;
            }
          }
        }
      }
      activeRows.push(r);
    });
    return activeRows;
  }, [rawData]);

  // --- State for filters ---
  const [dateType, setDateType] = React.useState('poDate');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [filters, setFilters] = React.useState({ po: '', stage: '', type: '', inhouse: '', category: '', search: '' });
  const [selectedKPI, setSelectedKPI] = React.useState(null);

  // --- Unique options ---
  const uniquePOs = React.useMemo(() => [...new Set(data.map(r => r.po))].sort(), [data]);
  const DONE_STAGES = /^(READY|STOCK|STORES?)$/i;
  const normStage = s => {
    if (!s) return '';
    const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
    if (/^STOCK[K]?$/.test(t)) return 'STOCK';
    if (/^R[EAD]{2,4}Y$/.test(t)) return 'READY';
    if (/^ST[OERATS]{2,5}$/.test(t)) return 'STORES';
    return t;
  };
  const uniqueStages = React.useMemo(() => ['READY', 'STOCK', 'STORES'], []);
  const uniqueTypes = React.useMemo(() => [...new Set(data.map(r => r.type))].filter(Boolean).sort(), [data]);

  // --- Date filter logic ---
  function dateInRange(val) {
    if (!val) return true;
    const d = val.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  }

  // --- Filtered data ---
  const isDoneStage = s => {
    if (!s) return false;
    const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
    if (t === 'READY') return true;
    if (t === 'STORES') return true;
    if (t === 'STOCK') return true;
    if (t === 'EXSTOCK') return true;
    if (t === 'VA') return true; // VA is a terminal stage
    if (/^STOCK{1,2}$/.test(t)) return true;
    if (/^READ{1,2}Y$/.test(t)) return true;
    if (t === 'STORE') return true; // singular alias
    return false;
  };

  const normStageDB = s => {
    if (!s) return '';
    const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
    if (/^STOCK[K]?$/.test(t)) return 'STOCK';
    if (t === 'READY' || /^R[EAD]{2,4}Y$/.test(t)) return 'READY';
    return 'STORES';
  };

  const filtered = React.useMemo(() => {
    const result = data.filter(row => {
      const dateVal = dateType === 'poDate' ? row.poDate : row.timestamp;
      if (!dateInRange(dateVal)) return false;
      if (filters.po && row.po !== filters.po) return false;
      if (filters.stage) {
        if ((row.currentStage || '').trim() !== filters.stage) return false;
      }
      if (filters.type && row.type !== filters.type) return false;
      if (filters.inhouse && row.inhouse !== filters.inhouse) return false;
      if (filters.category && getProductCategory && getProductCategory(row.type) !== filters.category) return false;
      if (filters.search) {
        const s = filters.search.trim().toLowerCase();
        const scStr = String(row.sc || '').toLowerCase();
        const poStr = String(row.po || '').toLowerCase();
        const prodStr = String(row.product || '').toLowerCase();
        const scMatch = scStr === s || scStr.startsWith(s);
        const poMatch = poStr.includes(s);
        const prodMatch = prodStr.includes(s);
        if (!scMatch && !prodMatch && !poMatch) return false;
        if (!scMatch && !prodMatch && poMatch) {
          if (!scStr.startsWith(s)) return false;
        }
      }
      return true;
    });

    // SORT BY PO RECEIVED DATE (ASCENDING)
    return result.sort((a, b) => {
      const dateA = a.poDate ? new Date(a.poDate).getTime() : 0;
      const dateB = b.poDate ? new Date(b.poDate).getTime() : 0;
      return dateA - dateB;
    });
  }, [data, filters, fromDate, toDate, dateType]);

  // allScItemsModal: full SC→rows map (entire data, no filters) for completion checks
  const allScItemsModal = React.useMemo(() => {
    const m = {};
    data.forEach(r => {
      if (!r.sc) return;
      if (!m[r.sc]) m[r.sc] = [];
      m[r.sc].push(r);
    });
    Object.keys(m).forEach(sc => {
      m[sc] = normalizeProductsInGroup(m[sc]);
    });
    return m;
  }, [data]);

  // filteredScGroupsModal: SC→rows map restricted to current filtered view
  const filteredScGroupsModal = React.useMemo(() => {
    const m = {};
    filtered.forEach(r => {
      if (!r.sc) return;
      if (!m[r.sc]) m[r.sc] = [];
      m[r.sc].push(r);
    });
    Object.keys(m).forEach(sc => {
      m[sc] = normalizeProductsInGroup(m[sc]);
    });
    return m;
  }, [filtered]);

  const hasNonDateFilter = !!(filters.po || filters.search || filters.type || filters.inhouse || filters.category || filters.stage);

  // --- KPI stats ---
  const kpiStats = React.useMemo(() => {
    const total = filtered.length;

    const totalPOCount = new Set(data.filter(r => r.po).map(r => r.po)).size;
    const _getScFamily = sc => String(sc).trim().replace(/-\d+$/, '');
    const _scFamilySet = new Set();
    data.forEach(r => { if (r.sc) _scFamilySet.add(_getScFamily(r.sc)); });
    const totalSCCount = _scFamilySet.size;

    const _isDoneOrVA = s => {
      if (!s) return false;
      const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
      return ['READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK', 'VA'].includes(t) ||
             /^STOCK[K]?$/.test(t) || /^READ{1,2}Y$/.test(t);
    };

    const _scFinalMap = {};
    const dataBySc = {};
    data.forEach(r => {
      if (!r.sc) return;
      if (!dataBySc[r.sc]) dataBySc[r.sc] = [];
      dataBySc[r.sc].push(r);
    });
    Object.entries(dataBySc).forEach(([sc, rows]) => {
      _scFinalMap[sc] = {};
      const normalizedRows = normalizeProductsInGroup(rows);
      normalizedRows.forEach(r => {
        const pkey = (r.product || '__none__').trim();
        const ex = _scFinalMap[sc][pkey];
        if (!ex) { _scFinalMap[sc][pkey] = r; return; }
        const rDone = _isDoneOrVA(r.currentStage);
        const exDone = _isDoneOrVA(ex.currentStage);
        if (rDone && !exDone) { _scFinalMap[sc][pkey] = r; return; }
        if (!rDone && exDone) return;
        if (r._isLive && !ex._isLive) { _scFinalMap[sc][pkey] = r; return; }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) _scFinalMap[sc][pkey] = r;
      });
    });

    const _scStageCounts = { READY: 0, STORES: 0, STOCK: 0, EXSTOCK: 0 };
    Object.entries(_scFinalMap).forEach(([sc, prodMap]) => {
      const latestRows = Object.values(prodMap);
      if (latestRows.length > 0 && latestRows.every(r => _isDoneOrVA(r.currentStage))) {
        const seenStages = new Set();
        latestRows.forEach(r => {
          const st = String(r.currentStage || '').trim().toUpperCase();
          const norm = st === 'STORE' ? 'STORES' : /^STOCK[K]?$/.test(st) ? 'STOCK' : /^READ{1,2}Y$/.test(st) ? 'READY' : st;
          if (_scStageCounts[norm] !== undefined) seenStages.add(norm);
        });
        seenStages.forEach(s => { _scStageCounts[s]++; });
      }
    });

    const uniquePO = new Set(filtered.map(r => r.po)).size;
    const uniqueSC = new Set(filtered.map(r => r.sc)).size;
    const readyItemsCount = filtered.filter(r => isDoneStage(r.currentStage)).length;

    const scReceivedSet = new Set(
      filtered.filter(r => r.poDate).map(r => r.sc).filter(Boolean)
    );

    const allScItems = allScItemsModal;
    const filteredScGroups = filteredScGroupsModal;

    const getLatestPerProduct = rows => {
      const latestMap = {};
      rows.forEach(r => {
        const key = (r.product || '__none__').trim();
        const ex = latestMap[key];
        if (!ex) { latestMap[key] = r; return; }
        const rDone = isDoneStage(r.currentStage);
        const exDone = isDoneStage(ex.currentStage);
        if (rDone && !exDone) { latestMap[key] = r; return; }
        if (!rDone && exDone) return;
        if (r._isLive && !ex._isLive) { latestMap[key] = r; return; }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
      });
      return Object.values(latestMap);
    };

    const getLatestPerProductForVA = rows => {
      const latestMap = {};
      rows.forEach(r => {
        const key = (r.product || '__none__').trim();
        const ex = latestMap[key];
        if (!ex) { latestMap[key] = r; return; }
        const rDone = isDoneOrVAStage(r.currentStage);
        const exDone = isDoneOrVAStage(ex.currentStage);
        if (rDone && !exDone) { latestMap[key] = r; return; }
        if (!rDone && exDone) return;
        if (r._isLive && !ex._isLive) { latestMap[key] = r; return; }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
      });
      return Object.values(latestMap);
    };

    const scsToCheck = hasNonDateFilter
      ? Object.keys(filteredScGroups)
      : Object.keys(allScItems);

    const scCompletedSet = new Set(
      scsToCheck.filter(sc => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProduct(allRowsForSC);
        if (!(latestRows.length > 0 && latestRows.every(r => isDoneStage(r.currentStage)))) return false;
        if (fromDate || toDate) {
          const dateField = dateType === 'poDate' ? 'poDate' : 'timestamp';
          return latestRows.some(r => {
            const d = (r[dateField] || '').slice(0, 10);
            if (!d) return false;
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
          });
        }
        return true;
      })
    );
    const scReadySet = scCompletedSet;
    const getScPrefix = sc => String(sc).trim().replace(/-\d+$/, '');

    const scSetsReceivedSet = new Set(
      [...scReceivedSet].map(sc => getScPrefix(sc)).filter(Boolean)
    );

    const allPrefixes = [...new Set(
      data.filter(r => r.sc).map(r => getScPrefix(r.sc)).filter(Boolean)
    )];
    const scSetsCompletedSet = new Set(
      allPrefixes.filter(prefix => {
        const prefixSCs = Object.keys(allScItems).filter(sc => getScPrefix(sc) === prefix);
        if (prefixSCs.length === 0) return false;
        const allDone = prefixSCs.every(sc => {
          const latest = getLatestPerProduct(allScItems[sc] || []);
          return latest.length > 0 && latest.every(i => isDoneStage(i.currentStage));
        });
        if (!allDone) return false;
        return prefixSCs.some(sc =>
          (allScItems[sc] || []).some(i => {
            if (!i.timestamp) return false;
            const d = i.timestamp.slice(0, 10);
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
          })
        );
      })
    );

    const scSetsCompletedTotal = new Set(
      allPrefixes.filter(prefix => {
        const prefixSCs = Object.keys(allScItems).filter(sc => getScPrefix(sc) === prefix);
        if (prefixSCs.length === 0) return false;
        return prefixSCs.every(sc => {
          const latest = getLatestPerProduct(allScItems[sc] || []);
          return latest.length > 0 && latest.every(i => isDoneStage(i.currentStage));
        });
      })
    );

    const isDoneOrVAStage = s => {
      if (!s) return false;
      const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
      if (t === 'READY') return true;
      if (t === 'STORES') return true;
      if (t === 'STOCK') return true;
      if (t === 'EXSTOCK') return true;
      if (t === 'STORE') return true;
      if (/^STOCK[K]?$/.test(t)) return true;
      if (/^READ{1,2}Y$/.test(t)) return true;
      if (t === 'VA') return true;
      return false;
    };

    const scCompletedPlusVASet = new Set(
      scsToCheck.filter(sc => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProductForVA(allRowsForSC);
        if (!(latestRows.length > 0 && latestRows.every(r => isDoneOrVAStage(r.currentStage)))) return false;
        if (fromDate || toDate) {
          const dateField = dateType === 'poDate' ? 'poDate' : 'timestamp';
          return latestRows.every(r => {
            const d = (r[dateField] || '').slice(0, 10);
            if (!d) return false;
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
          });
        }
        return true;
      })
    );

    const vaBreakdown = (() => {
      const counts = { READY: 0, STOCK: 0, STORES: 0, EXSTOCK: 0, VA: 0 };
      scCompletedPlusVASet.forEach(sc => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProductForVA(allRowsForSC);
        if (latestRows.length > 0 && latestRows.every(r => isDoneOrVAStage(r.currentStage))) {
          latestRows.forEach(r => {
            if (fromDate || toDate) {
              const dateField = dateType === 'poDate' ? 'poDate' : 'timestamp';
              const d = (r[dateField] || '').slice(0, 10);
              if (!d) return;
              if (fromDate && d < fromDate) return;
              if (toDate && d > toDate) return;
            }
            const st = String(r.currentStage || '').trim().toUpperCase();
            if (st === 'READY') counts.READY++;
            else if (st === 'STOCK') counts.STOCK++;
            else if (st === 'EXSTOCK') counts.EXSTOCK++;
            else if (st === 'STORES' || st === 'STORE') counts.STORES++;
            else if (st === 'VA') counts.VA++;
          });
        }
      });
      return counts;
    })();

    return {
      total, uniquePO, uniqueSC, readyItemsCount,
      totalPOCount, totalSCCount, scStageCounts: _scStageCounts,
      scReceived: scReceivedSet.size,
      scCompleted: scCompletedSet.size,
      scReady: scReadySet.size,
      scSetsReceived: scSetsReceivedSet.size,
      scSetsCompleted: scSetsCompletedSet.size,
      scSetsCompletedTotal: scSetsCompletedTotal.size,
      scCompletedPlusVA: scCompletedPlusVASet.size,
      scCompletedPlusVASet,
      vaBreakdown,
    };
  }, [filtered, data, fromDate, toDate, dateType, allScItemsModal, filteredScGroupsModal, hasNonDateFilter]);

  // --- Export handlers ---
  function exportJSON() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const header = Object.keys(filtered[0] || {});
    const rows = filtered.map(r => header.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    // jsPDF imported at top
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    const exportRows = filtered.filter(r => isDoneStage(r.currentStage));

    const columns = [
      { header: 'SC', dataKey: 'sc' },
      { header: 'PO', dataKey: 'po' },
      { header: 'PO DATE', dataKey: 'poDate' },
      { header: 'PRODUCT', dataKey: 'product' },
      { header: 'STAGE', dataKey: 'currentStage' },
      { header: 'INHOUSE', dataKey: 'inhouse' },
      { header: 'TIMESTAMP', dataKey: 'timestamp' },
    ];

    const rows = exportRows.map(r => ({
      sc: r.sc || '',
      po: r.po || '',
      poDate: r.poDate ? fmtDate(r.poDate) : '',
      product: r.product || '',
      currentStage: r.currentStage || '',
      inhouse: r.inhouse || '',
      timestamp: r.timestamp ? fmtTs(r.timestamp) : '',
    }));

    doc.setFontSize(14);
    doc.text('Velan Metrology \u2013 Database Export', 40, 36);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const dateRange = (fromDate || toDate) ? ` | Date range: ${fromDate || '-'} to ${toDate || '-'}` : '';
    doc.text(`Exported Rows: ${rows.length}  (READY / STORES / STOCK only)${dateRange}`, 40, 52);
    doc.text(
      `Unique POs: ${kpiStats.uniquePO}   SC Sets: ${kpiStats.uniqueSC}   SC Received: ${kpiStats.scReceived}   SC Completed: ${kpiStats.scCompleted}   SC Ready: ${kpiStats.scReady}`,
      40, 66
    );

    doc.autoTable({
      columns,
      body: rows,
      startY: 82,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 100, 180] },
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
      bodyStyles: { textColor: 20 },
    });
    doc.save('database_export.pdf');
  }

  // --- Quick date buttons ---
  function setQuickDays(days) {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to);
  }

  return (
    <div>
      <div className="section-title">Database <span>Archive</span><div className="section-line" /></div>
      
      {/* ── HISTORY DATA MODULE ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="chart-card" style={{ marginBottom: 18, background: 'rgba(10,15,40,0.95)', border: '1px solid rgba(100,120,255,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🗃</span>
            <div>
              <div className="chart-title" style={{ marginBottom: 0, color: 'var(--accent3)' }}>History Archive Import</div>
              <div className="chart-sub">IMPORT PAST RECORDS — PERMANENTLY STORED IN DATABASE</div>
            </div>
          </div>
          {(historyRows || []).length > 0 && (
            <span style={{ background: 'rgba(100,120,255,0.15)', border: '1px solid rgba(100,120,255,0.4)', color: 'var(--accent3)', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontFamily: 'Share Tech Mono,monospace' }}>
              🗂 {(historyRows || []).length} history rows in DB
              {((historyRows || []).length !== (data || []).length) && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>· {(data || []).length} total (incl. live)</span>
              )}
            </span>
          )}
        </div>

        {/* OPTION 1: Upload File from Device */}
        <div style={{ marginBottom: 16, padding: 16, background: 'rgba(15,110,86,0.08)', border: '2px dashed rgba(0,230,118,0.4)', borderRadius: 8, textAlign: 'center', cursor: 'pointer' }}
          onDragOver={e => { e.preventDefault(); e.target.style.borderColor = 'rgba(0,230,118,0.8)'; }}
          onDragLeave={e => { e.target.style.borderColor = 'rgba(0,230,118,0.4)'; }}
          onDrop={e => { e.preventDefault(); handleHistoryDragDrop(e); }}
          onClick={() => document.getElementById('historyFileInput')?.click()}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📤</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', marginBottom: 4, letterSpacing: 1 }}>
            DRAG & DROP BACKUP FILE HERE
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            or click to browse — supports .xlsx, .xls, .csv, .json
          </div>
          <input
            id="historyFileInput"
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            style={{ display: 'none' }}
            onChange={e => handleHistoryFileUpload(e.target.files?.[0])}
          />
        </div>

        {/* OPTION 2: Paste Google Sheets URL */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 280 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 1 }}>OR PASTE GOOGLE SHEETS CSV URL</div>
            <input
              type="text"
              value={historyConfig?.url || ''}
              onChange={e => setHistoryConfig(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/YOUR_ID/export?format=csv"
              style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid rgba(100,120,255,0.4)', borderRadius: 6, color: 'var(--text-primary)', padding: '9px 12px', fontSize: 11, fontFamily: 'Share Tech Mono,monospace' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <button
              className="filter-btn"
              style={{ padding: '10px 18px', background: importState?.loading ? 'rgba(100,120,255,0.08)' : 'rgba(100,120,255,0.18)', border: '1px solid rgba(100,120,255,0.5)', color: 'var(--accent3)', fontWeight: 700 }}
              onClick={onSyncHistory}
              disabled={importState?.loading}
            >
              {importState?.loading ? '⏳ Importing…' : '📥 Import from URL'}
            </button>
            <button className="filter-btn" style={{ padding: '10px' }} onClick={() => setHistoryConfig({ url: '' })}>🧹 Clear</button>
          </div>
        </div>

        {/* Status Message */}
        {importState?.lastMsg && (
          <div style={{
            marginTop: 10,
            background: importState.lastMsg.startsWith('✅') ? 'rgba(0,230,118,0.07)' : importState.lastMsg.startsWith('❌') ? 'rgba(255,61,90,0.07)' : 'rgba(0,201,255,0.07)',
            border: `1px solid ${importState.lastMsg.startsWith('✅') ? 'rgba(0,230,118,0.3)' : importState.lastMsg.startsWith('❌') ? 'rgba(255,61,90,0.3)' : 'rgba(0,201,255,0.25)'}`,
            borderRadius: 7, padding: '9px 14px',
            color: importState.lastMsg.startsWith('✅') ? 'var(--success)' : importState.lastMsg.startsWith('❌') ? 'var(--danger)' : 'var(--accent1)',
            fontSize: 11, fontFamily: 'Share Tech Mono,monospace'
          }}>
            {importState.lastMsg}
          </div>
        )}

        {/* Database Reset Button */}
        <div style={{ marginTop: 12, display: 'flex', justifyIframe: 'flex-end', justifyContent: 'flex-end' }}>
          <button
            className="filter-btn"
            style={{ padding: '10px 18px', background: 'rgba(255,61,90,0.12)', border: '1px solid rgba(255,61,90,0.5)', color: 'var(--danger)', fontWeight: 700 }}
            onClick={onResetDB}
            disabled={importState?.loading}
          >
            🗑 Reset Entire DB (WARNING)
          </button>
        </div>

        {/* Info Box */}
        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.7, padding: '8px 12px', background: 'rgba(100,120,255,0.04)', border: '1px solid rgba(100,120,255,0.1)', borderRadius: 7 }}>
          <strong style={{ color: 'var(--accent3)' }}>ℹ Database-only:</strong> Imported history rows are stored permanently in Neon PostgreSQL and visible <strong>only on this page</strong>. They do not appear in Production, Stage/WIP, or any other module. Duplicates are automatically skipped.
        </div>
      </div>
    )}

      {/* FILTER BAR */}
      <div className="chart-card" style={{ marginBottom: 16, background: 'rgba(0,20,40,0.9)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`filter-btn${dateType === 'poDate' ? ' active' : ''}`} onClick={() => setDateType('poDate')}>PO Received Date</button>
            <button className={`filter-btn${dateType === 'timestamp' ? ' active' : ''}`} onClick={() => setDateType('timestamp')}>Last Updated Timestamp</button>
          </div>
          <input type="date" className="filter-input" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
          <input type="date" className="filter-input" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
          <button className="filter-btn reset" onClick={() => { setFromDate(''); setToDate(''); }}>✕ Reset</button>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <button className="filter-btn" onClick={() => setQuickDays(7)}>Last 7 Days</button>
            <button className="filter-btn" onClick={() => setQuickDays(14)}>Last 14 Days</button>
            <button className="filter-btn" onClick={() => setQuickDays(30)}>Last 30 Days</button>
            <button className="filter-btn" onClick={() => setQuickDays(60)}>Last 60 Days</button>
            <button className="filter-btn" onClick={() => setQuickDays(90)}>Last 90 Days</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="filter-select" value={filters.po} onChange={e => setFilters(f => ({ ...f, po: e.target.value }))}>
            <option value="">All POs</option>
            {uniquePOs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="filter-select" value={filters.stage} onChange={e => setFilters(f => ({ ...f, stage: e.target.value }))}>
            <option value="">All Stages</option>
            {['STORES', 'STOCK', 'READY'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="filter-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">All Types</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="filter-select" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            <option value="AIRPLUG">Airplug (APG/ARG)</option>
            <option value="MASTER">Master (SRG/SP/SPG)</option>
            <option value="ACCESSORY">Accessories</option>
          </select>
          <select className="filter-select" value={filters.inhouse} onChange={e => setFilters(f => ({ ...f, inhouse: e.target.value }))}>
            <option value="">Inhouse + Vendor</option>
            <option value="INHOUSE">Inhouse Only</option>
            <option value="VENDOR">Vendor Only</option>
          </select>
          <input className="filter-input" placeholder="Search SC / Product / PO..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ minWidth: 200 }} />
          <button className="filter-btn reset" onClick={() => setFilters({ po: '', stage: '', type: '', inhouse: '', category: '', search: '' })}>✕ Reset</button>
          <span style={{ marginLeft: 'auto', fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} filtered · {data.length} total</span>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        <div className="kpi-card" style={{ '--c1': '#00c9ff', '--c2': '#0fa8e0' }}>
          <div className="kpi-label">TOTAL POs</div>
          <div className="kpi-value">{kpiStats.totalPOCount}</div>
          <div className="kpi-sub">
            all POs in database
            {(fromDate || toDate) && <span style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--accent1)' }}>{kpiStats.uniquePO} in selected range</span>}
          </div>
        </div>
        <div className="kpi-card" style={{ '--c1': '#b24bff', '--c2': '#00c9ff' }}>
          <div className="kpi-label">TOTAL SCs</div>
          <div className="kpi-value">{kpiStats.totalSCCount}</div>
          <div className="kpi-sub">
            unique SC sets in database (1211-1 &amp; 1211-2 = 1 set)
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {[
                { label: 'READY', val: kpiStats.scStageCounts?.READY, c: 'var(--success)' },
                { label: 'STORES', val: kpiStats.scStageCounts?.STORES, c: 'var(--accent1)' },
                { label: 'STOCK', val: kpiStats.scStageCounts?.STOCK, c: 'var(--warning)' },
                { label: 'EXSTOCK', val: kpiStats.scStageCounts?.EXSTOCK, c: 'var(--accent6)' },
              ].map(s => (
                <span key={s.label} style={{ fontSize: 9, fontFamily: 'Share Tech Mono,monospace', color: s.val > 0 ? s.c : 'var(--text-muted)', background: s.val > 0 ? s.c + '22' : 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '1px 5px' }}>
                  {s.label}: {s.val || 0}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="kpi-card" style={{ '--c1': '#ffd60a', '--c2': '#ff6b35' }}>
          <div className="kpi-label">SC RECEIVED</div>
          <div className="kpi-value" style={{ color: 'var(--accent5)' }}>{kpiStats.scReceived}</div>
          <div className="kpi-sub">
            SCs with PO date in range
            {fromDate && <span style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}>from {fromDate}</span>}
            {toDate && <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)' }}>to {toDate}</span>}
            {!fromDate && !toDate && <span style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}>all dates</span>}
          </div>
        </div>
        <div className="kpi-card" style={{ '--c1': '#00e676', '--c2': '#00c9ff', cursor: 'pointer' }} onClick={() => setSelectedKPI('scCompleted')}>
          <div className="kpi-label">SC COMPLETED</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpiStats.scCompleted}</div>
          <div className="kpi-sub">
            all items READY/STOCK/STORES/EXSTOCK
            {fromDate && <span style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}>from {fromDate}</span>}
            {toDate && <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)' }}>to {toDate}</span>}
            {!fromDate && !toDate && <span style={{ display: 'block', fontSize: 9, marginTop: 3, color: 'var(--text-muted)' }}>all dates</span>}
          </div>
          <button
            onClick={e => { e.stopPropagation(); setSelectedKPI('scCompletedPlusVA'); }}
            style={{
              marginTop: 10, padding: '4px 10px',
              border: '1px solid rgba(255,107,53,0.5)',
              background: 'rgba(255,107,53,0.1)',
              color: 'var(--accent4)', borderRadius: 6,
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Share Tech Mono,monospace', letterSpacing: 0.5,
            }}
            title="View SC Completed including VA stage"
          >+VA View ({kpiStats.scCompletedPlusVA})</button>
        </div>
      </div>

      {/* EXPORT BUTTONS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button className="filter-btn" style={{ background: 'rgba(0,201,255,0.08)', color: 'var(--accent1)', fontWeight: 700 }} onClick={exportJSON}>⬇ JSON</button>
        <button className="filter-btn" style={{ background: 'rgba(0,255,100,0.08)', color: 'var(--success)', fontWeight: 700 }} onClick={exportCSV}>⬇ CSV</button>
        <button className="filter-btn" style={{ background: 'rgba(255,61,90,0.08)', color: 'var(--danger)', fontWeight: 700 }} onClick={exportPDF}>⬇ PDF</button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>EXPORT COMPLETED ITEMS ({(() => {
          const dm = {};
          const groups = {};
          filtered.forEach(r => {
            if (!r.sc) return;
            if (!groups[r.sc]) groups[r.sc] = [];
            groups[r.sc].push(r);
          });
          Object.keys(groups).forEach(sc => {
            const normalized = normalizeProductsInGroup(groups[sc]);
            normalized.forEach(r => {
              const k = (r.sc || '') + '||' + (r.product || '').trim();
              const ex = dm[k];
              if (!ex) { dm[k] = r; return; }
              const rD = isDoneStage(r.currentStage), eD = isDoneStage(ex.currentStage);
              if (rD && !eD) { dm[k] = r; return; } if (!rD && eD) return;
              if (r._isLive && !ex._isLive) { dm[k] = r; return; } if (!r._isLive && ex._isLive) return;
              if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) dm[k] = r;
            });
          });
          return Object.values(dm).filter(r => isDoneStage(r.currentStage)).length;
        })()} rows — READY / STOCK / STORES / EXSTOCK only):</span>
      </div>

      {/* DATA TABLE — READY / STOCK / STORES only (completed items, deduplicated) */}
      {(() => {
        const dedupeMap = {};
        const groups = {};
        filtered.forEach(r => {
          if (!r.sc) return;
          if (!groups[r.sc]) groups[r.sc] = [];
          groups[r.sc].push(r);
        });
        Object.keys(groups).forEach(sc => {
          const normalized = normalizeProductsInGroup(groups[sc]);
          normalized.forEach(r => {
            const key = (r.sc || '') + '||' + (r.product || '__none__').trim();
            const ex = dedupeMap[key];
            if (!ex) { dedupeMap[key] = r; return; }
            const rDone = isDoneStage(r.currentStage);
            const exDone = isDoneStage(ex.currentStage);
            if (rDone && !exDone) { dedupeMap[key] = r; return; }
            if (!rDone && exDone) return;
            if (r._isLive && !ex._isLive) { dedupeMap[key] = r; return; }
            if (!r._isLive && ex._isLive) return;
            if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) dedupeMap[key] = r;
          });
        });
        const deduped = Object.values(dedupeMap).sort((a, b) => {
          const da = a.poDate ? new Date(a.poDate).getTime() : 0;
          const db = b.poDate ? new Date(b.poDate).getTime() : 0;
          return da - db;
        });
        const tableRows = deduped.filter(r => isDoneStage(r.currentStage));
        const wipCount = deduped.length - tableRows.length;
        return (
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              <div>
                <div className="chart-title">Completed Items — {tableRows.length} shown</div>
                <div className="chart-sub">READY / STOCK / STORES / EXSTOCK ONLY · {wipCount} in-process items hidden · HISTORY + LIVE COMBINED · LATEST STATE PER PRODUCT</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <span style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontFamily: 'Share Tech Mono,monospace' }}>
                  ✓ {tableRows.length} DONE
                </span>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: 12, maxHeight: 500 }}>
              <table>
                <thead>
                  <tr><th>SC</th><th>PO</th><th>PO DATE</th><th>PRODUCT</th><th>STAGE</th><th>INHOUSE</th><th>TIMESTAMP</th></tr>
                </thead>
                <tbody>{tableRows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono text-accent">{r.sc || '—'}</td>
                    <td style={{ fontSize: 11 }}>{r.po || '—'}</td>
                    <td className="mono" style={{ fontSize: 10 }}>{fmtDate(r.poDate)}</td>
                    <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product || '—'}</td>
                    <td><span className="status-pill" style={{
                      background: r.currentStage === 'READY' ? 'rgba(0,230,118,0.15)' : r.currentStage === 'STORES' ? 'rgba(0,201,255,0.15)' : r.currentStage === 'EXSTOCK' ? 'rgba(178,75,255,0.15)' : 'rgba(255,214,10,0.15)',
                      color: r.currentStage === 'READY' ? 'var(--success)' : r.currentStage === 'STORES' ? 'var(--accent1)' : r.currentStage === 'EXSTOCK' ? 'var(--accent6)' : 'var(--warning)'
                    }}>{r.currentStage || '—'}</span></td>
                    <td><span className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}>{r.inhouse}</span></td>
                    <td className="mono" style={{ fontSize: 10 }}>{fmtTs(r.timestamp)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* DETAIL MODAL - Show completed SCs details */}
      {selectedKPI === 'scCompleted' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--accent3)', borderRadius: 12, padding: 24, maxWidth: 800, maxHeight: '80vh', overflow: 'auto', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent3)', marginBottom: 4 }}>SC COMPLETED ({kpiStats.scCompleted})</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>All items READY/STOCK/STORES/EXSTOCK</div>
              </div>
              <button onClick={() => setSelectedKPI(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>CLOSE</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10 }}>SC</th>
                  <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10 }}>PO</th>
                  <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10 }}>PRODUCT</th>
                  <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10 }}>STAGE</th>
                  <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: 10 }}>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const scsInView = Object.keys(filteredScGroupsModal);

                  const completedSCs = scsInView
                    .map(sc => {
                      const filteredRows = filteredScGroupsModal[sc] || [];
                      if (filteredRows.length === 0) return null;

                      const latestMap = {};
                      filteredRows.forEach(r => {
                        const key = (r.product || '__none__').trim();
                        const ex = latestMap[key];
                        if (!ex) { latestMap[key] = r; return; }
                        const rDone = isDoneStage(r.currentStage);
                        const exDone = isDoneStage(ex.currentStage);
                        if (rDone && !exDone) { latestMap[key] = r; return; }
                        if (!rDone && exDone) return;
                        if (r._isLive && !ex._isLive) { latestMap[key] = r; return; }
                        if (!r._isLive && ex._isLive) return;
                        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
                      });
                      const latestRows = Object.values(latestMap);
                      return latestRows.length > 0 ? [sc, latestRows] : null;
                    })
                    .filter(item => item !== null)
                    .filter(([, latestRows]) => latestRows.every(r => isDoneStage(r.currentStage)));

                  if (completedSCs.length === 0) {
                    return (
                      <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        No completed SC sets found for the current filters.
                      </td></tr>
                    );
                  }

                  return completedSCs.map(([sc, latestRows], i) => (
                    latestRows.map((r, j) => (
                      <tr key={sc + '-' + j} style={{ borderBottom: '1px solid var(--border)', backgroundColor: i % 2 ? 'rgba(0,201,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '10px', color: 'var(--accent1)', fontFamily: 'Share Tech Mono', fontWeight: 700 }}>{j === 0 ? sc : ''}</td>
                        <td style={{ padding: '10px', fontSize: 11 }}>{r.po || '—'}</td>
                        <td style={{ padding: '10px', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product || '—'}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            background: r.currentStage === 'READY' ? 'rgba(0,230,118,0.15)' : r.currentStage === 'STORES' ? 'rgba(0,201,255,0.15)' : 'rgba(255,214,10,0.15)',
                            color: r.currentStage === 'READY' ? 'var(--success)' : r.currentStage === 'STORES' ? 'var(--accent1)' : 'var(--warning)',
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700
                          }}>{r.currentStage || '—'}</span>
                        </td>
                        <td style={{ padding: '10px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>{r.timestamp ? r.timestamp.slice(0, 10) : '—'}</td>
                      </tr>
                    ))
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL — SC COMPLETED + VA BREAKDOWN */}
      {selectedKPI === 'scCompletedPlusVA' && (() => {
        function exportModalJSON() {
          const blob = new Blob([JSON.stringify(completedPlusVARows, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = 'sc_completed_plus_va.json'; a.click();
        }
        function exportModalCSV() {
          const header = ['sc', 'po', 'product', 'currentStage', 'inhouse', 'timestamp'];
          const rows = completedPlusVARows.map(r => header.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','));
          const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = 'sc_completed_plus_va.csv'; a.click();
        }
        function exportModalPDF() {
          // jsPDF imported at top
          const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
          doc.setFontSize(14);
          doc.text('Velan Metrology \u2013 SC COMPLETED + VA', 40, 36);
          doc.setFontSize(9); doc.setTextColor(80, 80, 80);
          doc.text(
            `READY: ${kpiStats.vaBreakdown.READY}  STOCK: ${kpiStats.vaBreakdown.STOCK}  STORES: ${kpiStats.vaBreakdown.STORES}  SC COMPLETED: ${kpiStats.scCompleted}  VA: ${kpiStats.vaBreakdown.VA}  SC COMPLETED+VA: ${kpiStats.scCompletedPlusVA}`,
            40, 52
          );
          doc.autoTable({
            columns: [
              { header: 'SC', dataKey: 'sc' }, { header: 'PO', dataKey: 'po' },
              { header: 'PRODUCT', dataKey: 'product' }, { header: 'STAGE', dataKey: 'currentStage' },
              { header: 'INHOUSE', dataKey: 'inhouse' }, { header: 'TIMESTAMP', dataKey: 'timestamp' },
            ],
            body: completedPlusVARows.map(r => ({
              sc: r.sc || '', po: r.po || '', product: r.product || '',
              currentStage: r.currentStage || '', inhouse: r.inhouse || '',
              timestamp: r.timestamp ? fmtTs(r.timestamp) : '',
            })),
            startY: 68, styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [255, 107, 53] }, theme: 'grid',
            margin: { left: 40, right: 40 },
          });
          doc.save('sc_completed_plus_va.pdf');
        }

        const isDoneOrVA = s => {
          if (!s) return false;
          const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
          return ['READY', 'STOCK', 'STORES', 'STORE', 'EXSTOCK', 'VA'].includes(t) || /^STOCK[K]?$/.test(t) || /^READ{1,2}Y$/.test(t);
        };
        const getLatestPP = rows => {
          const m = {};
          rows.forEach(r => {
            const key = (r.product || '__none__').trim();
            const ex = m[key];
            if (!ex) { m[key] = r; return; }
            const rD = isDoneOrVA(r.currentStage), eD = isDoneOrVA(ex.currentStage);
            if (rD && !eD) { m[key] = r; return; } if (!rD && eD) return;
            if (r._isLive && !ex._isLive) { m[key] = r; return; } if (!r._isLive && ex._isLive) return;
            if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) m[key] = r;
          });
          return Object.values(m);
        };
        const completedPlusVASCs = [...kpiStats.scCompletedPlusVASet].map(sc => {
          const rows = (allScItemsModal[sc] || []);
          if (rows.length === 0) return null;
          const latest = getLatestPP(rows).filter(r => {
            if (!fromDate && !toDate) return true;
            const dateField = dateType === 'poDate' ? 'poDate' : 'timestamp';
            const d = (r[dateField] || '').slice(0, 10);
            if (!d) return false;
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
          });
          if (latest.length > 0 && latest.every(r => isDoneOrVA(r.currentStage))) return [sc, latest];
          return null;
        })
          .filter(Boolean);

        const completedPlusVARows = completedPlusVASCs.flatMap(([, rows]) => rows);

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyIframe: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-card)', border: '2px solid var(--accent4)', borderRadius: 12, padding: 24, maxWidth: 860, maxHeight: '85vh', overflow: 'auto', width: '92%' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent4)', marginBottom: 6, fontFamily: 'Rajdhani,sans-serif', letterSpacing: 1 }}>
                    SC COMPLETED + VA BREAKDOWN
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 4 }}>
                    {[
                      { label: 'READY', val: kpiStats.vaBreakdown.READY, c: 'var(--success)' },
                      { label: 'STOCK', val: kpiStats.vaBreakdown.STOCK, c: 'var(--warning)' },
                      { label: 'STORES', val: kpiStats.vaBreakdown.STORES, c: 'var(--accent1)' },
                      { label: 'EXSTOCK', val: kpiStats.vaBreakdown.EXSTOCK, c: 'var(--accent6)' },
                    ].map(s => (
                      <span key={s.label} style={{ fontSize: 12, fontFamily: 'Share Tech Mono,monospace' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s.label}: </span>
                        <span style={{ color: s.c, fontWeight: 700 }}>{s.val}</span>
                      </span>
                    ))}
                    <span style={{ fontSize: 12, fontFamily: 'Share Tech Mono,monospace', borderLeft: '1px solid var(--border)', paddingLeft: 18 }}>
                      <span style={{ color: 'var(--text-muted)' }}>SC COMPLETED: </span>
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>{kpiStats.scCompleted}</span>
                    </span>
                    <span style={{ fontSize: 12, fontFamily: 'Share Tech Mono,monospace' }}>
                      <span style={{ color: 'var(--text-muted)' }}>VA: </span>
                      <span style={{ color: 'var(--accent4)', fontWeight: 700 }}>{kpiStats.vaBreakdown.VA}</span>
                    </span>
                    <span style={{ fontSize: 12, fontFamily: 'Share Tech Mono,monospace', borderLeft: '1px solid var(--border)', paddingLeft: 18 }}>
                      <span style={{ color: 'var(--text-muted)' }}>SC COMPLETED + VA: </span>
                      <span style={{ color: 'var(--accent4)', fontWeight: 700 }}>{kpiStats.scCompletedPlusVA}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono,monospace' }}>
                    {completedPlusVASCs.length} sets · includes READY / STOCK / STORES / EXSTOCK / VA
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  <button onClick={exportModalJSON} style={{ padding: '5px 11px', border: '1px solid rgba(0,201,255,0.4)', background: 'rgba(0,201,255,0.08)', color: 'var(--accent1)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>⬇ JSON</button>
                  <button onClick={exportModalCSV} style={{ padding: '5px 11px', border: '1px solid rgba(0,230,118,0.4)', background: 'rgba(0,230,118,0.08)', color: 'var(--success)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>⬇ CSV</button>
                  <button onClick={exportModalPDF} style={{ padding: '5px 11px', border: '1px solid rgba(255,61,90,0.4)', background: 'rgba(255,61,90,0.08)', color: 'var(--danger)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>⬇ PDF</button>
                  <button onClick={() => setSelectedKPI(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>CLOSE</button>
                </div>
              </div>

              {/* Item Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['SC', 'PO', 'PRODUCT', 'STAGE', 'TIMESTAMP'].map(h => (
                      <th key={h} style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono,monospace', fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completedPlusVASCs.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      No SC+VA completed sets found for the current filters.
                    </td></tr>
                  ) : completedPlusVASCs.map(([sc, latestRows], i) =>
                    latestRows.map((r, j) => (
                      <tr key={sc + '-' + j} style={{ borderBottom: '1px solid var(--border)', backgroundColor: i % 2 ? 'rgba(255,107,53,0.02)' : 'transparent' }}>
                        <td style={{ padding: '10px', color: 'var(--accent1)', fontFamily: 'Share Tech Mono,monospace', fontWeight: 700 }}>{j === 0 ? sc : ''}</td>
                        <td style={{ padding: '10px', fontSize: 11 }}>{r.po || '—'}</td>
                        <td style={{ padding: '10px', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product || '—'}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            background:
                              r.currentStage === 'READY' ? 'rgba(0,230,118,0.15)' :
                                r.currentStage === 'STORES' ? 'rgba(0,201,255,0.15)' :
                                  r.currentStage === 'EXSTOCK' ? 'rgba(178,75,255,0.15)' :
                                    r.currentStage === 'VA' ? 'rgba(255,107,53,0.15)' :
                                      'rgba(255,214,10,0.15)',
                            color:
                              r.currentStage === 'READY' ? 'var(--success)' :
                                r.currentStage === 'STORES' ? 'var(--accent1)' :
                                  r.currentStage === 'EXSTOCK' ? 'var(--accent6)' :
                                    r.currentStage === 'VA' ? 'var(--accent4)' :
                                      'var(--warning)',
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          }}>{r.currentStage || '—'}</span>
                        </td>
                        <td style={{ padding: '10px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono,monospace' }}>{r.timestamp ? r.timestamp.slice(0, 10) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default DatabasePage;