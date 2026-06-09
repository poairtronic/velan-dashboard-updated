import React from 'react';
import { useData } from '../context/DataContext';
import { useUI } from '../context/UIContext';
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
// ─── UPLOAD DATA PAGE COMPONENT ───────────────────────────────────────────────

function UploadPage() {
  const {
    data = [],
    uploadStatus,
    setUploadStatus,
    importState,
    saveRowsToServer,
    importRowsToDb,
    handleFileUpload,
    handleHistoryFileUpload,
    handleHistoryDragDrop,
    syncLiveDataNow,
    syncHistorySheet,
    resetDB,
    liveConfig,
    setLiveConfig,
    historyConfig,
    setHistoryConfig,
  } = useData();
  const { liveState } = useUI();

  const [drag, setDrag] = React.useState(false);
  const fileRef = React.useRef();

  function handleDrop(e) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
      e.target.value = ''; // Reset so same file can be re-uploaded
    }
  }

  async function downloadTemplate() {
    const rows = [
      {
        SNO: 1,
        'PO NO': 'AGIPLPO2326',
        'PO RECD DATE': '2026-03-25',
        SC: '1170',
        'Product Name': 'ARG DIA 15.2 +0.03',
        QTY: '1 NO',
        'STATUS 1': 'LATHE COMPLETED, MOVE TO M1',
        'STATUS 2': 'MOVE TO STORES',
        'INHOUSE/ VENDOR': 'INHOUSE',
        OP: 'READY',
        TIMESTAMP: '2026-04-15 19:20:04',
      },
      {
        SNO: '',
        'PO NO': '',
        'PO RECD DATE': '',
        SC: '1170',
        'Product Name': 'SP DIA 15.2 +0.03',
        QTY: '1 SET',
        'STATUS 1': 'SET MOVE TO FB',
        'STATUS 2': 'MOVE TO STORES',
        'INHOUSE/ VENDOR': 'INHOUSE',
        OP: 'READY',
        TIMESTAMP: '2026-04-15 19:24:04',
      },
      {
        SNO: '',
        'PO NO': '',
        'PO RECD DATE': '',
        SC: '1170',
        'Product Name': 'M6 T CONNECTOR',
        QTY: '1 NO',
        'STATUS 1': 'INHOUSE',
        'STATUS 2': '',
        'INHOUSE/ VENDOR': 'INHOUSE',
        OP: 'STOCK',
        TIMESTAMP: '2026-03-30 11:03:33',
      },
      {
        SNO: 2,
        'PO NO': 'AGIPLPO14',
        'PO RECD DATE': '2026-03-25',
        SC: '1187',
        'Product Name': 'APG DIA 24.0 -0.007/-0.028',
        QTY: '1 NO',
        'STATUS 1': 'MOVE TO FB',
        'STATUS 2': 'MOVE TO STORES',
        'INHOUSE/ VENDOR': 'INHOUSE',
        OP: 'READY',
        TIMESTAMP: '2026-04-13 18:14:43',
      },
      {
        SNO: '',
        'PO NO': '',
        'PO RECD DATE': '',
        SC: '1187',
        'Product Name': 'SRG DIA 24.0 -0.007/-0.028',
        QTY: '1 NO',
        'STATUS 1': 'HT,SZ COMPLETED,MOVE TO SG',
        'STATUS 2': 'MOVE TO STORES',
        'INHOUSE/ VENDOR': 'INHOUSE',
        OP: 'READY',
        TIMESTAMP: '2026-04-13 18:23:27',
      },
      {
        SNO: '',
        'PO NO': '',
        'PO RECD DATE': '',
        SC: '1187',
        'Product Name': 'VERTICAL BENCH MOUNT PLATE',
        QTY: '1 NO',
        'STATUS 1': 'INHOUSE',
        'STATUS 2': '',
        'INHOUSE/ VENDOR': 'VENDOR',
        OP: 'SDV',
        TIMESTAMP: '2026-04-13 17:01:58',
      },
    ];
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 30 },
      { wch: 8 },
      { wch: 35 },
      { wch: 20 },
      { wch: 14 },
      { wch: 10 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'stdtrack');
    XLSX.writeFile(wb, 'velan_template.xlsx');
  }

  async function exportCurrentData() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production');
    const d = new Date();
    const exportDate =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0');
    XLSX.writeFile(wb, `velan_export_${exportDate}.xlsx`);
  }

  const statusColors = {
    success: { bg: 'rgba(0,230,118,0.1)', border: 'rgba(0,230,118,0.4)', color: 'var(--success)' },
    error: { bg: 'rgba(255,61,90,0.1)', border: 'rgba(255,61,90,0.4)', color: 'var(--danger)' },
    warn: { bg: 'rgba(255,184,54,0.1)', border: 'rgba(255,184,54,0.4)', color: 'var(--warning)' },
    loading: { bg: 'rgba(0,201,255,0.08)', border: 'rgba(0,201,255,0.3)', color: 'var(--accent1)' },
  };

  return (
    <div>
      <div className="section-title">
        Data <span>Upload</span>
        <div className="section-line" />
      </div>

      {/* Status Banner */}
      {uploadStatus && (
        <div
          style={{
            background: statusColors[uploadStatus.type]?.bg || statusColors.loading.bg,
            border: `1px solid ${statusColors[uploadStatus.type]?.border || statusColors.loading.border}`,
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                color: statusColors[uploadStatus.type]?.color || statusColors.loading.color,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {uploadStatus.msg}
            </div>
            {uploadStatus.detail && (
              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  fontFamily: 'Share Tech Mono, monospace',
                  marginTop: 6,
                  whiteSpace: 'pre-line',
                }}
              >
                {uploadStatus.detail}
              </div>
            )}
          </div>
          <button
            onClick={() => setUploadStatus(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="chart-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="chart-card">
          <div className="chart-title">Upload New Data</div>
          <div className="chart-sub">
            EXCEL (.XLSX / .XLS), CSV, OR JSON — FLEXIBLE COLUMN NAMES SUPPORTED
          </div>
          <div
            className={`upload-zone${drag ? ' drag' : ''}`}
            style={{ marginTop: 16 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current.click()}
          >
            <div className="upload-icon">{uploadStatus?.type === 'loading' ? '⏳' : '📤'}</div>
            <div className="upload-text">
              {uploadStatus?.type === 'loading' ? 'Processing file…' : 'Drag & Drop your file here'}
            </div>
            <div className="upload-sub">or click to browse — xlsx, xls, csv, json</div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* GOOGLE SHEETS LIVE SYNC */}
          <div
            style={{
              marginTop: 14,
              padding: '14px 16px',
              background: 'rgba(15,110,86,0.08)',
              border: '1px solid rgba(15,110,86,0.4)',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00e676', letterSpacing: 1 }}>
                  GOOGLE SHEETS LIVE SYNC
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Paste any Google Sheets URL — share link, edit link, or CSV export
                </div>
              </div>
              {liveState?.active && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(0,230,118,0.15)',
                    border: '1px solid rgba(0,230,118,0.4)',
                    color: 'var(--success)',
                    borderRadius: 20,
                    padding: '3px 10px',
                    fontSize: 10,
                    fontFamily: 'Share Tech Mono',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      background: 'var(--success)',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s infinite',
                      display: 'inline-block',
                    }}
                  />
                  LIVE
                </span>
              )}
            </div>

            <input
              type="text"
              value={liveConfig?.url || ''}
              onChange={(e) => setLiveConfig((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/e/YOUR_ID/pub?output=csv  ← paste Publish to web CSV link"
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                padding: '9px 12px',
                fontSize: 11,
                marginBottom: 10,
                fontFamily: 'Share Tech Mono,monospace',
              }}
            />

            <div
              style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 10,
                fontSize: 10,
                color: 'var(--text-muted)',
                lineHeight: 1.8,
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                📋 How to get the Live Google Sheets CSV link:
              </div>
              <div>
                1. Open your Google Sheet →{' '}
                <strong style={{ color: 'var(--accent1)' }}>File → Share → Publish to web</strong>
              </div>
              <div>
                2. Select <strong style={{ color: 'var(--success)' }}>Entire Document</strong> → set
                format to <strong style={{ color: 'var(--success)' }}>CSV (.csv)</strong>
              </div>
              <div>
                3. Click <strong style={{ color: 'var(--accent5)' }}>Publish</strong> → Copy the
                link and paste above
              </div>
              <div style={{ marginTop: 4, color: 'var(--accent3)' }}>
                ✓ Link ends with /pub?output=csv — paste it directly, no changes needed
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="number"
                min="30"
                value={liveConfig.intervalSec || 300}
                onChange={(e) =>
                  setLiveConfig((prev) => ({ ...prev, intervalSec: Number(e.target.value) || 300 }))
                }
                style={{
                  width: 80,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  padding: '6px 8px',
                  fontSize: 11,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>sec refresh</span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginLeft: 'auto',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={liveConfig.enabled === true}
                  onChange={(e) =>
                    setLiveConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
                Auto-sync
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="filter-btn"
                style={{
                  flex: 2,
                  padding: '10px',
                  background: 'rgba(0,230,118,0.12)',
                  border: '1px solid rgba(0,230,118,0.4)',
                  color: 'var(--success)',
                  fontWeight: 700,
                }}
                onClick={() => syncLiveDataNow(liveConfig?.url)}
              >
                🔄 Sync from Google Sheets Now
              </button>
              <button
                className="filter-btn"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setLiveConfig({ url: '', enabled: false, intervalSec: 300 })}
              >
                🧹 Clear
              </button>
            </div>

            <div
              style={{
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'Share Tech Mono,monospace',
              }}
            >
              <span>LAST SYNC: {liveState?.lastSync || '—'}</span>
              <span style={{ color: liveState?.active ? 'var(--success)' : 'var(--text-muted)' }}>
                {liveState?.active ? '● CONNECTED' : '○ NOT SYNCED'}
              </span>
            </div>
            {liveState?.lastError && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: 'var(--danger)',
                  fontFamily: 'Share Tech Mono,monospace',
                  whiteSpace: 'pre-line',
                  background: 'rgba(255,61,90,0.05)',
                  border: '1px solid rgba(255,61,90,0.2)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                ⚠ {liveState.lastError}
              </div>
            )}
          </div>

          {/* Tips */}
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: 'rgba(0,201,255,0.05)',
              border: '1px solid rgba(0,201,255,0.15)',
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: 'var(--text-muted)',
                fontFamily: 'Share Tech Mono,monospace',
                marginBottom: 6,
              }}
            >
              SUPPORTED DATA SOURCES
            </div>
            <ul
              style={{
                color: 'var(--text-secondary)',
                fontSize: 11,
                paddingLeft: 16,
                lineHeight: 1.9,
              }}
            >
              <li>
                <span className="mono text-accent">Google Sheets (Publish to web)</span> — File →
                Share → Publish to web → Entire Document → CSV → Copy link. Backend proxy handles
                CORS automatically.
              </li>
              <li>
                <span className="mono text-accent">Excel (.xlsx/.xls)</span> — Drag & drop your
                Velan production workbook. Merged cells, PO fill-down, SNO/SC structure all parse
                correctly.
              </li>
              <li>
                <span className="mono text-accent">CSV / JSON</span> — Direct file upload or URL.
                Flexible column name detection.
              </li>
              <li>
                <span className="mono text-accent">No "type" column needed</span> — product type
                auto-detected from name prefix (APG, SRG, ARG, SP, etc.)
              </li>
              <li>
                Required columns:{' '}
                <span className="mono text-accent">
                  SC, PO NO, PO RECD DATE, Product Name, STATUS 1, INHOUSE/VENDOR, OP, TIMESTAMP
                </span>
              </li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              className="filter-btn"
              onClick={downloadTemplate}
              style={{ flex: 1, padding: '10px' }}
            >
              ⬇ Download Template
            </button>
            <button
              className="filter-btn"
              onClick={exportCurrentData}
              style={{ flex: 1, padding: '10px' }}
            >
              📊 Export Current ({data.length} rows)
            </button>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Column Mapping Guide</div>
          <div className="chart-sub">ACCEPTED COLUMN NAMES (ANY VARIATION WORKS)</div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: 'var(--text-muted)',
              fontFamily: 'Share Tech Mono,monospace',
              marginBottom: 6,
            }}
          >
            YOUR EXCEL COLUMNS (VELAN FORMAT)
          </div>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>YOUR COLUMN</th>
                  <th>MAPS TO</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['SC', 'Job Set No', 'Required. Fills down within each gauge set'],
                  ['PO NO', 'Purchase Order', 'Required. Fills down within each PO group'],
                  ['PO RECD DATE', 'PO Date', 'Date the PO was received'],
                  ['Product Name', 'Product', 'Required. Type is AUTO-DETECTED from name prefix'],
                  ['STATUS 1', 'Current Operation', 'What is happening now'],
                  ['STATUS 2', 'Next Operation', 'Where it moves after current op'],
                  ['INHOUSE/ VENDOR', 'Location', '"INHOUSE" or "VENDOR"'],
                  ['OP', 'Current Stage', 'Stage code: READY, LATHE, CG, VA, STORES etc.'],
                  ['TIMESTAMP', 'Last Updated', 'Date-time of last status update'],
                  [
                    'type column',
                    '(not needed)',
                    '✅ Auto-inferred from Product Name prefix (APG/SRG/ARG/SP...)',
                  ],
                ].map(([col, maps, note], i) => (
                  <tr key={i}>
                    <td className="mono text-accent" style={{ whiteSpace: 'nowrap' }}>
                      {col}
                    </td>
                    <td
                      style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                    >
                      {maps}
                    </td>
                    <td style={{ fontSize: 10, color: 'var(--text-muted)' }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-title">Current Data Preview — {data.length} rows loaded</div>
        <div className="chart-sub">FIRST 50 ROWS OF ACTIVE DATASET</div>
            <DataTable headers={['SC', 'PO', 'PRODUCT', 'TYPE', 'STAGE', 'INHOUSE', 'TIMESTAMP']} isLoading={uploadStatus?.type === 'loading'} isEmpty={data.length === 0} emptyMessage="Upload data to preview">
              {data.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td className="mono text-accent">{r.sc || '—'}</td>
                  <td style={{ fontSize: 11 }}>{r.po}</td>
                  <td
                    style={{
                      fontSize: 11,
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.product || '—'}
                  </td>
                  <td>
                    <span className="status-pill badge-blue">{r.type || '—'}</span>
                  </td>
                  <td>
                    <span
                      className="status-pill"
                      style={{
                        background: getStageColor(r.currentStage) + '22',
                        color: getStageColor(r.currentStage),
                      }}
                    >
                      {r.currentStage || '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}
                    >
                      {r.inhouse}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 10 }}>
                    {r.timestamp?.substring(0, 16) || '—'}
                  </td>
                </tr>
              ))}
            </DataTable>
      </div>
    </div>
  );
}

export default UploadPage;
