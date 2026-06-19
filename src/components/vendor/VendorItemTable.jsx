import React from 'react';
import calculationUtils from '../../utils/calculationUtils';
const { TARGET_DAYS, calculateProcessCycleTime, daysBetween  } = calculationUtils;
import { fmtTs } from '../../utils/dateUtils';

import VirtualizedTable from '../ui/VirtualizedTable';

function VendorItemTable({ data, todayRef, selectedItem, setSelectedItem, setSelectedSC }) {
  return (
    <div className="table-card" style={{ marginTop: 16 }}>
      <div className="table-header">
        <div className="chart-title">
          Vendor Process Aging & Cycle Time — Item Level (Today Reference)
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <VirtualizedTable
          headers={['SC', 'PO', 'PRODUCT', 'PROCESS', 'LAST UPDATE', 'PENDING DAYS', 'CYCLE TIME', 'SLA STATUS', 'STATUS']}
          data={data
            .filter((r) => r.inhouse === 'VENDOR')
            .map((r) => {
              const pendingDays = daysBetween(r.timestamp, todayRef);
              const cycleTime = calculateProcessCycleTime(r.poDate, r.timestamp);
              const slaViolation = pendingDays !== null && pendingDays > 2;
              return { ...r, pendingDays, cycleTime, slaViolation };
            })
            .sort((a, b) => (b.pendingDays || 0) - (a.pendingDays || 0))}
          height={600}
          itemSize={50}
          RowComponent={({ row: r }) => {
            const pending = r.pendingDays;
            const cycle = r.cycleTime;
            const overdue = pending != null && pending > TARGET_DAYS;
            const slaStatus = r.slaViolation ? 'VIOLATION' : 'COMPLIANT';
            return (
              <div
                onClick={() => setSelectedItem(r)}
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: selectedItem === r ? 'rgba(255,107,53,0.08)' : 'transparent',
                }}
                title="Click to view item details"
              >
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSC(r.sc);
                    }}
                    className="mono text-accent fw7"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: 12,
                    }}
                    title={`View all products for SC ${r.sc || '—'}`}
                  >
                    {r.sc || '—'}
                  </button>
                </div>
                <div style={{ flex: 1, padding: '0 12px', fontSize: 11 }}>{r.po || '—'}</div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontSize: 11,
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.product || '—'}
                </div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span className="status-pill s-vendor">{r.currentStage || 'UNKNOWN'}</span>
                </div>
                <div className="mono" style={{ flex: 1, padding: '0 12px', fontSize: 10 }}>
                  {fmtTs(r.timestamp)}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 14,
                    color: overdue ? 'var(--danger)' : 'var(--success)',
                  }}
                >
                  {pending != null ? `${pending}d` : '—'}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--accent1)',
                  }}
                >
                  {cycle != null ? `${cycle}d` : '—'}
                </div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span className={`status-pill ${r.slaViolation ? 'badge-red' : 'badge-green'}`}>
                    {slaStatus}
                  </span>
                </div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span className={`status-pill ${overdue ? 'badge-red' : 'badge-green'}`}>
                    {overdue ? 'DELAYED' : 'ACTIVE'}
                  </span>
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

export default React.memo(VendorItemTable);

