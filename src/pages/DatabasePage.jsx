import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useUI } from '../context/UIContext';
import { useAuth } from '../hooks/useAuth';

// Hooks
import { useDatabaseFilters } from '../hooks/useDatabaseFilters';
import { useDatabaseKPIs } from '../hooks/useDatabaseKPIs';
import { useDatabaseExport } from '../hooks/useDatabaseExport';

// Components
import DatabaseHistoryManager from '../components/database/DatabaseHistoryManager';
import DatabaseFilterBar from '../components/database/DatabaseFilterBar';
import DatabaseKPIs from '../components/database/DatabaseKPIs';
import DatabaseTable from '../components/database/DatabaseTable';

import { fmtDate, fmtTs } from '../utils/dateUtils';
import { normalizeProductsInGroup } from '../utils/calculationUtils';

// ─── DATABASE PAGE COMPONENT ──────────────────────────────────────────────────

function DatabasePage() {
  const { isAdmin } = useAuth();
  const {
    allDbData: rawData,
    data: historyRows,
    historyConfig,
    setHistoryConfig,
    syncHistorySheet: onSyncHistory,
    resetDB: onResetDB,
    handleHistoryFileUpload,
    handleHistoryDragDrop,
  } = useData();
  const { importState } = useUI();

  // 1. Filtering Logic
  const {
    data,
    filtered,
    dateType,
    setDateType,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    filters,
    setFilters,
    allScItemsModal,
    filteredScGroupsModal,
    hasNonDateFilter,
    setQuickDays,
    dateInRange,
  } = useDatabaseFilters(rawData);

  // 2. KPI Logic
  const [selectedKPI, setSelectedKPI] = useState(null);
  
  const kpiStats = useDatabaseKPIs(activeFilters);

  // 3. Export Logic
  const { exportJSON, exportCSV, exportPDF } = useDatabaseExport(activeFilters, kpiStats);

  // Constants
  const uniquePOs = [...new Set(data.map((r) => r.po))].sort();
  const uniqueTypes = [...new Set(data.map((r) => r.type))].filter(Boolean).sort();

  return (
    <div>
      <div className="section-title">
        Database <span>Archive</span>
        <div className="section-line" />
      </div>

      <DatabaseHistoryManager
        isAdmin={isAdmin}
        historyRows={historyRows}
        dataLength={data.length}
        historyConfig={historyConfig}
        setHistoryConfig={setHistoryConfig}
        onSyncHistory={onSyncHistory}
        onResetDB={onResetDB}
        handleHistoryFileUpload={handleHistoryFileUpload}
        handleHistoryDragDrop={handleHistoryDragDrop}
        importState={importState}
      />

      <DatabaseFilterBar
        dateType={dateType}
        setDateType={setDateType}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        setQuickDays={setQuickDays}
        filters={filters}
        setFilters={setFilters}
        uniquePOs={uniquePOs}
        uniqueTypes={uniqueTypes}
        filteredCount={filtered.length}
        totalCount={data.length}
      />

      <DatabaseKPIs
        kpiStats={kpiStats}
        fromDate={fromDate}
        toDate={toDate}
        setSelectedKPI={setSelectedKPI}
      />

      {/* EXPORT BUTTONS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button
          className="filter-btn"
          style={{ background: 'rgba(0,201,255,0.08)', color: 'var(--accent1)', fontWeight: 700 }}
          onClick={exportJSON}
        >
          ⬇ JSON
        </button>
        <button
          className="filter-btn"
          style={{ background: 'rgba(0,255,100,0.08)', color: 'var(--success)', fontWeight: 700 }}
          onClick={exportCSV}
        >
          ⬇ CSV
        </button>
        <button
          className="filter-btn"
          style={{ background: 'rgba(255,61,90,0.08)', color: 'var(--danger)', fontWeight: 700 }}
          onClick={exportPDF}
        >
          ⬇ PDF
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
          EXPORT COMPLETED ITEMS (
          {(() => {
            const dm = {};
            const groups = {};
            filtered.forEach((r) => {
              if (!r.sc) return;
              if (!groups[r.sc]) groups[r.sc] = [];
              groups[r.sc].push(r);
            });
            Object.keys(groups).forEach((sc) => {
              const normalized = normalizeProductsInGroup(groups[sc]);
              normalized.forEach((r) => {
                const k = (r.sc || '') + '||' + (r.product || '').trim();
                const ex = dm[k];
                if (!ex) {
                  dm[k] = r;
                  return;
                }
                const rD = kpiStats.isDoneStage(r.currentStage),
                  eD = kpiStats.isDoneStage(ex.currentStage);
                if (rD && !eD) {
                  dm[k] = r;
                  return;
                }
                if (!rD && eD) return;
                if (r._isLive && !ex._isLive) {
                  dm[k] = r;
                  return;
                }
                if (!r._isLive && ex._isLive) return;
                if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) dm[k] = r;
              });
            });
            return Object.values(dm).filter((r) => kpiStats.isDoneStage(r.currentStage)).length;
          })()}{' '}
          rows — READY / STOCK / STORES / EXSTOCK only):
        </span>
      </div>

      <DatabaseTable filters={filters} />

      {/* DETAIL MODAL - Show completed SCs details */}
      {selectedKPI === 'scCompleted' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--accent3)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 800,
              maxHeight: '80vh',
              overflow: 'auto',
              width: '90%',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--accent3)',
                    marginBottom: 4,
                  }}
                >
                  SC COMPLETED ({kpiStats.scCompleted})
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'Share Tech Mono',
                  }}
                >
                  All items READY/STOCK/STORES/EXSTOCK
                </div>
              </div>
              <button
                onClick={() => setSelectedKPI(null)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                CLOSE
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th
                    style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontFamily: 'Share Tech Mono',
                      fontSize: 10,
                    }}
                  >
                    SC
                  </th>
                  <th
                    style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontFamily: 'Share Tech Mono',
                      fontSize: 10,
                    }}
                  >
                    PO
                  </th>
                  <th
                    style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontFamily: 'Share Tech Mono',
                      fontSize: 10,
                    }}
                  >
                    PRODUCT
                  </th>
                  <th
                    style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontFamily: 'Share Tech Mono',
                      fontSize: 10,
                    }}
                  >
                    STAGE
                  </th>
                  <th
                    style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontFamily: 'Share Tech Mono',
                      fontSize: 10,
                    }}
                  >
                    TIMESTAMP
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const scsInView = Object.keys(filteredScGroupsModal);

                  const completedSCs = scsInView
                    .map((sc) => {
                      const filteredRows = filteredScGroupsModal[sc] || [];
                      if (filteredRows.length === 0) return null;

                      const latestMap = {};
                      filteredRows.forEach((r) => {
                        const key = (r.product || '__none__').trim();
                        const ex = latestMap[key];
                        if (!ex) {
                          latestMap[key] = r;
                          return;
                        }
                        const rDone = kpiStats.isDoneStage(r.currentStage);
                        const exDone = kpiStats.isDoneStage(ex.currentStage);
                        if (rDone && !exDone) {
                          latestMap[key] = r;
                          return;
                        }
                        if (!rDone && exDone) return;
                        if (r._isLive && !ex._isLive) {
                          latestMap[key] = r;
                          return;
                        }
                        if (!r._isLive && ex._isLive) return;
                        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp))
                          latestMap[key] = r;
                      });
                      const latestRows = Object.values(latestMap);
                      return latestRows.length > 0 ? [sc, latestRows] : null;
                    })
                    .filter((item) => item !== null)
                    .filter(([, latestRows]) =>
                      latestRows.every((r) => kpiStats.isDoneStage(r.currentStage))
                    );

                  if (completedSCs.length === 0) {
                    return (
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                          }}
                        >
                          No completed SC sets found for the current filters.
                        </td>
                      </tr>
                    );
                  }

                  return completedSCs.map(([sc, latestRows], i) =>
                    latestRows.map((r, j) => (
                      <tr
                        key={sc + '-' + j}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: i % 2 ? 'rgba(0,201,255,0.02)' : 'transparent',
                        }}
                      >
                        <td
                          style={{
                            padding: '10px',
                            color: 'var(--accent1)',
                            fontFamily: 'Share Tech Mono',
                            fontWeight: 700,
                          }}
                        >
                          {j === 0 ? sc : ''}
                        </td>
                        <td style={{ padding: '10px', fontSize: 11 }}>{r.po || '—'}</td>
                        <td
                          style={{
                            padding: '10px',
                            fontSize: 11,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.product || '—'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span
                            style={{
                              background:
                                r.currentStage === 'READY'
                                  ? 'rgba(0,230,118,0.15)'
                                  : r.currentStage === 'STORES'
                                    ? 'rgba(0,201,255,0.15)'
                                    : r.currentStage === 'EXSTOCK'
                                      ? 'rgba(178,75,255,0.15)'
                                      : 'rgba(255,214,10,0.15)',
                              color:
                                r.currentStage === 'READY'
                                  ? 'var(--success)'
                                  : r.currentStage === 'STORES'
                                    ? 'var(--accent1)'
                                    : r.currentStage === 'EXSTOCK'
                                      ? 'var(--accent6)'
                                      : 'var(--warning)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {r.currentStage || '—'}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px',
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            fontFamily: 'Share Tech Mono',
                          }}
                        >
                          {r.timestamp ? r.timestamp.slice(0, 10) : '—'}
                        </td>
                      </tr>
                    ))
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL — SC COMPLETED + VA BREAKDOWN */}
      {selectedKPI === 'scCompletedPlusVA' &&
        (() => {
          function exportModalJSON() {
            const blob = new Blob([JSON.stringify(completedPlusVARows, null, 2)], {
              type: 'application/json',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'sc_completed_plus_va.json';
            a.click();
          }
          function exportModalCSV() {
            const header = ['sc', 'po', 'product', 'currentStage', 'inhouse', 'timestamp'];
            const rows = completedPlusVARows.map((r) =>
              header.map((h) => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(',')
            );
            const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'sc_completed_plus_va.csv';
            a.click();
          }
          function exportModalPDF() {
            import('jspdf').then(({ jsPDF }) => {
              import('jspdf-autotable').then(() => {
                const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
                doc.setFontSize(14);
                doc.text('Velan Metrology \u2013 SC COMPLETED + VA', 40, 36);
                doc.setFontSize(9);
                doc.setTextColor(80, 80, 80);
                doc.text(
                  `READY: ${kpiStats.vaBreakdown.READY}  STOCK: ${kpiStats.vaBreakdown.STOCK}  STORES: ${kpiStats.vaBreakdown.STORES}  SC COMPLETED: ${kpiStats.scCompleted}  VA: ${kpiStats.vaBreakdown.VA}  SC COMPLETED+VA: ${kpiStats.scCompletedPlusVA}`,
                  40,
                  52
                );
                doc.autoTable({
                  columns: [
                    { header: 'SC', dataKey: 'sc' },
                    { header: 'PO', dataKey: 'po' },
                    { header: 'PRODUCT', dataKey: 'product' },
                    { header: 'STAGE', dataKey: 'currentStage' },
                    { header: 'INHOUSE', dataKey: 'inhouse' },
                    { header: 'TIMESTAMP', dataKey: 'timestamp' },
                  ],
                  body: completedPlusVARows.map((r) => ({
                    sc: r.sc || '',
                    po: r.po || '',
                    product: r.product || '',
                    currentStage: r.currentStage || '',
                    inhouse: r.inhouse || '',
                    timestamp: r.timestamp ? fmtTs(r.timestamp) : '',
                  })),
                  startY: 68,
                  styles: { fontSize: 8, cellPadding: 3 },
                  headStyles: { fillColor: [255, 107, 53] },
                  theme: 'grid',
                  margin: { left: 40, right: 40 },
                });
                doc.save('sc_completed_plus_va.pdf');
              });
            });
          }

          const isDoneOrVA = (s) => {
            if (!s) return false;
            const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
            return (
              ['READY', 'STOCK', 'STORES', 'STORE', 'EXSTOCK', 'VA'].includes(t) ||
              /^STOCK[K]?$/.test(t) ||
              /^READ{1,2}Y$/.test(t)
            );
          };
          const getLatestPP = (rows) => {
            const m = {};
            rows.forEach((r) => {
              const key = (r.product || '__none__').trim();
              const ex = m[key];
              if (!ex) {
                m[key] = r;
                return;
              }
              const rD = isDoneOrVA(r.currentStage),
                eD = isDoneOrVA(ex.currentStage);
              if (rD && !eD) {
                m[key] = r;
                return;
              }
              if (!rD && eD) return;
              if (r._isLive && !ex._isLive) {
                m[key] = r;
                return;
              }
              if (!r._isLive && ex._isLive) return;
              if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) m[key] = r;
            });
            return Object.values(m);
          };
          const completedPlusVASCs = [...kpiStats.scCompletedPlusVASet]
            .map((sc) => {
              const rows = allScItemsModal[sc] || [];
              if (rows.length === 0) return null;
              const latest = getLatestPP(rows).filter((r) => {
                if (!fromDate && !toDate) return true;
                const dateField = dateType === 'poDate' ? 'poDate' : 'timestamp';
                const d = (r[dateField] || '').slice(0, 10);
                if (!d) return false;
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                return true;
              });
              if (latest.length > 0 && latest.every((r) => isDoneOrVA(r.currentStage)))
                return [sc, latest];
              return null;
            })
            .filter(Boolean);

          const completedPlusVARows = completedPlusVASCs.flatMap(([, rows]) => rows);

          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyIframe: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--accent4)',
                  borderRadius: 12,
                  padding: 24,
                  maxWidth: 860,
                  maxHeight: '85vh',
                  overflow: 'auto',
                  width: '92%',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 16,
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--accent4)',
                        marginBottom: 6,
                        fontFamily: 'Rajdhani,sans-serif',
                        letterSpacing: 1,
                      }}
                    >
                      SC COMPLETED + VA BREAKDOWN
                    </div>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 4 }}>
                      {[
                        { label: 'READY', val: kpiStats.vaBreakdown.READY, c: 'var(--success)' },
                        { label: 'STOCK', val: kpiStats.vaBreakdown.STOCK, c: 'var(--warning)' },
                        { label: 'STORES', val: kpiStats.vaBreakdown.STORES, c: 'var(--accent1)' },
                        {
                          label: 'EXSTOCK',
                          val: kpiStats.vaBreakdown.EXSTOCK,
                          c: 'var(--accent6)',
                        },
                      ].map((s) => (
                        <span
                          key={s.label}
                          style={{ fontSize: 12, fontFamily: 'Share Tech Mono,monospace' }}
                        >
                          <span style={{ color: 'var(--text-muted)' }}>{s.label}: </span>
                          <span style={{ color: s.c, fontWeight: 700 }}>{s.val}</span>
                        </span>
                      ))}
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: 'Share Tech Mono,monospace',
                          borderLeft: '1px solid var(--border)',
                          paddingLeft: 18,
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>SC COMPLETED: </span>
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                          {kpiStats.scCompleted}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, fontFamily: 'Share Tech Mono,monospace' }}>
                        <span style={{ color: 'var(--text-muted)' }}>VA: </span>
                        <span style={{ color: 'var(--accent4)', fontWeight: 700 }}>
                          {kpiStats.vaBreakdown.VA}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: 'Share Tech Mono,monospace',
                          borderLeft: '1px solid var(--border)',
                          paddingLeft: 18,
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>SC COMPLETED + VA: </span>
                        <span style={{ color: 'var(--accent4)', fontWeight: 700 }}>
                          {kpiStats.scCompletedPlusVA}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        fontFamily: 'Share Tech Mono,monospace',
                      }}
                    >
                      {completedPlusVASCs.length} sets · includes READY / STOCK / STORES / EXSTOCK /
                      VA
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                      onClick={exportModalJSON}
                      style={{
                        padding: '5px 11px',
                        border: '1px solid rgba(0,201,255,0.4)',
                        background: 'rgba(0,201,255,0.08)',
                        color: 'var(--accent1)',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⬇ JSON
                    </button>
                    <button
                      onClick={exportModalCSV}
                      style={{
                        padding: '5px 11px',
                        border: '1px solid rgba(0,230,118,0.4)',
                        background: 'rgba(0,230,118,0.08)',
                        color: 'var(--success)',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⬇ CSV
                    </button>
                    <button
                      onClick={exportModalPDF}
                      style={{
                        padding: '5px 11px',
                        border: '1px solid rgba(255,61,90,0.4)',
                        background: 'rgba(255,61,90,0.08)',
                        color: 'var(--danger)',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⬇ PDF
                    </button>
                    <button
                      onClick={() => setSelectedKPI(null)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        borderRadius: 6,
                        padding: '5px 12px',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      CLOSE
                    </button>
                  </div>
                </div>

                {/* Item Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['SC', 'PO', 'PRODUCT', 'STAGE', 'TIMESTAMP'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px',
                            textAlign: 'left',
                            color: 'var(--text-muted)',
                            fontFamily: 'Share Tech Mono,monospace',
                            fontSize: 10,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedPlusVASCs.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                          }}
                        >
                          No SC+VA completed sets found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      completedPlusVASCs.map(([sc, latestRows], i) =>
                        latestRows.map((r, j) => (
                          <tr
                            key={sc + '-' + j}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              backgroundColor: i % 2 ? 'rgba(255,107,53,0.02)' : 'transparent',
                            }}
                          >
                            <td
                              style={{
                                padding: '10px',
                                color: 'var(--accent1)',
                                fontFamily: 'Share Tech Mono,monospace',
                                fontWeight: 700,
                              }}
                            >
                              {j === 0 ? sc : ''}
                            </td>
                            <td style={{ padding: '10px', fontSize: 11 }}>{r.po || '—'}</td>
                            <td
                              style={{
                                padding: '10px',
                                fontSize: 11,
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {r.product || '—'}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <span
                                style={{
                                  background:
                                    r.currentStage === 'READY'
                                      ? 'rgba(0,230,118,0.15)'
                                      : r.currentStage === 'STORES'
                                        ? 'rgba(0,201,255,0.15)'
                                        : r.currentStage === 'EXSTOCK'
                                          ? 'rgba(178,75,255,0.15)'
                                          : r.currentStage === 'VA'
                                            ? 'rgba(255,107,53,0.15)'
                                            : 'rgba(255,214,10,0.15)',
                                  color:
                                    r.currentStage === 'READY'
                                      ? 'var(--success)'
                                      : r.currentStage === 'STORES'
                                        ? 'var(--accent1)'
                                        : r.currentStage === 'EXSTOCK'
                                          ? 'var(--accent6)'
                                          : r.currentStage === 'VA'
                                            ? 'var(--accent4)'
                                            : 'var(--warning)',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {r.currentStage || '—'}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: '10px',
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                fontFamily: 'Share Tech Mono,monospace',
                              }}
                            >
                              {r.timestamp ? r.timestamp.slice(0, 10) : '—'}
                            </td>
                          </tr>
                        ))
                      )
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
