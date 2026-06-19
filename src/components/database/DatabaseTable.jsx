import React from 'react';
import { fmtDate, fmtTs } from '../../utils/dateUtils';
import calculationUtils from '../../utils/calculationUtils';
const { normalizeProductsInGroup  } = calculationUtils;
import VirtualizedTable from '../ui/VirtualizedTable';

function DatabaseTable({ filtered, isDoneStage }) {
  const dedupeMap = {};
  const groups = {};
  filtered.forEach((r) => {
    if (!r.sc) return;
    if (!groups[r.sc]) groups[r.sc] = [];
    groups[r.sc].push(r);
  });
  Object.keys(groups).forEach((sc) => {
    const normalized = normalizeProductsInGroup(groups[sc]);
    normalized.forEach((r) => {
      const key = (r.sc || '') + '||' + (r.product || '__none__').trim();
      const ex = dedupeMap[key];
      if (!ex) {
        dedupeMap[key] = r;
        return;
      }
      const rDone = isDoneStage(r.currentStage);
      const exDone = isDoneStage(ex.currentStage);
      if (rDone && !exDone) {
        dedupeMap[key] = r;
        return;
      }
      if (!rDone && exDone) return;
      if (r._isLive && !ex._isLive) {
        dedupeMap[key] = r;
        return;
      }
      if (!r._isLive && ex._isLive) return;
      if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) dedupeMap[key] = r;
    });
  });
  
  const deduped = Object.values(dedupeMap).sort((a, b) => {
    const da = a.poDate ? new Date(a.poDate).getTime() : 0;
    const db = b.poDate ? new Date(b.poDate).getTime() : 0;
    return da - db;
  });
  
  const tableRows = deduped.filter((r) => isDoneStage(r.currentStage));
  const wipCount = deduped.length - tableRows.length;

  return (
    <div className="chart-card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div>
          <div className="chart-title">Completed Items — {tableRows.length} shown</div>
          <div className="chart-sub">
            READY / STOCK / STORES / EXSTOCK ONLY · {wipCount} in-process items hidden ·
            HISTORY + LIVE COMBINED · LATEST STATE PER PRODUCT
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              background: 'rgba(0,230,118,0.12)',
              border: '1px solid rgba(0,230,118,0.3)',
              color: 'var(--success)',
              borderRadius: 20,
              padding: '3px 12px',
              fontSize: 11,
              fontFamily: 'Share Tech Mono,monospace',
            }}
          >
            ✓ {tableRows.length} DONE
          </span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <VirtualizedTable
          headers={['SC', 'PO', 'PO DATE', 'PRODUCT', 'STAGE', 'INHOUSE', 'TIMESTAMP']}
          data={tableRows}
          height={500}
          RowComponent={({ row: r }) => (
            <>
              <div style={{ flex: 1, padding: '0 12px' }} className="mono text-accent">{r.sc || '—'}</div>
              <div style={{ flex: 1, padding: '0 12px', fontSize: 11 }}>{r.po || '—'}</div>
              <div style={{ flex: 1, padding: '0 12px', fontSize: 10 }} className="mono">{fmtDate(r.poDate)}</div>
              <div style={{ flex: 1, padding: '0 12px', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.product || '—'}
              </div>
              <div style={{ flex: 1, padding: '0 12px' }}>
                <span
                  className="status-pill"
                  style={{
                    background:
                      r.currentStage === 'READY' ? 'rgba(0,230,118,0.15)' : 
                      r.currentStage === 'STORES' ? 'rgba(0,201,255,0.15)' : 
                      r.currentStage === 'EXSTOCK' ? 'rgba(178,75,255,0.15)' : 'rgba(255,214,10,0.15)',
                    color:
                      r.currentStage === 'READY' ? 'var(--success)' : 
                      r.currentStage === 'STORES' ? 'var(--accent1)' : 
                      r.currentStage === 'EXSTOCK' ? 'var(--accent6)' : 'var(--warning)',
                  }}
                >
                  {r.currentStage || '—'}
                </span>
              </div>
              <div style={{ flex: 1, padding: '0 12px' }}>
                <span className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}>
                  {r.inhouse}
                </span>
              </div>
              <div style={{ flex: 1, padding: '0 12px', fontSize: 10 }} className="mono">
                {fmtTs(r.timestamp)}
              </div>
            </>
          )}
          isEmpty={tableRows.length === 0}
        />
      </div>
    </div>
  );
}

export default DatabaseTable;
