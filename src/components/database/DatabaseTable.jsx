import React, { useState } from 'react';
import { useDashboardDataQuery } from '../../hooks/queries/useDashboardQueries';
import VirtualizedTable from '../ui/VirtualizedTable';
import { fmtDate, fmtTs } from '../../utils/dateUtils';

function DatabaseTable({ filters }) {
  const [page, setPage] = useState(1);
  const limit = 200;

  // We want to fetch only completed items if that's the logic for this table, 
  // but to preserve exact business logic without changing backend wildly, 
  // we pass the existing filters. 
  // If the user expects ONLY done stages here, we should inject that into filters:
  const fetchFilters = { ...filters, status: 'done' };

  const { data: res, isLoading } = useDashboardDataQuery(fetchFilters, page, limit);

  const tableRows = res?.data?.rows || [];
  const totalCount = res?.data?.totalCount || 0;
  const totalPages = res?.data?.totalPages || 1;

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
          <div className="chart-title">Database Records — {totalCount} total items</div>
          <div className="chart-sub">
            HISTORY + LIVE COMBINED · PAGINATED VIEW
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <button 
            disabled={page <= 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '4px 10px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '4px 10px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
          >
            Next
          </button>
        </div>
      </div>
      
      <VirtualizedTable
        headers={['SC', 'PO', 'PO DATE', 'PRODUCT', 'STAGE', 'INHOUSE', 'TIMESTAMP']}
        data={tableRows}
        height={500}
        isLoading={isLoading}
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
  );
}

export default DatabaseTable;
