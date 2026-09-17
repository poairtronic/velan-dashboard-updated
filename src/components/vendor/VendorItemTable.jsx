import React from 'react';
import calculationUtils from '../../utils/calculationUtils.js';
const { TARGET_DAYS, calculateProcessCycleTime, daysBetween, getVendorInfo } = calculationUtils;
import { fmtTs } from '../../utils/dateUtils';

import VirtualizedTable from '../ui/VirtualizedTable';
import TableExportDropdown from '../TableExportDropdown';

function VendorItemTable({ data = [], todayRef, selectedItem, setSelectedItem, setSelectedSC }) {
  const headers = ['SC', 'PO', 'PRODUCT', 'VENDOR', 'PROCESS', 'LAST UPDATE', 'PENDING DAYS', 'CYCLE TIME', 'SLA STATUS', 'STATUS'];
  
  const processedData = (data || [])
    .filter((r) => {
      const vInfo = getVendorInfo(r);
      return vInfo && vInfo.isVendor;
    })
    .map((r) => {
      const vInfo = getVendorInfo(r);
      const pendingDays = r.timestamp
        ? daysBetween(r.timestamp, todayRef)
        : (r.poDate ? daysBetween(r.poDate, todayRef) : null);
      const cycleTime = calculateProcessCycleTime(r.poDate, r.timestamp);
      const slaViolation = pendingDays !== null && pendingDays > 2;
      return { ...r, vInfo, pendingDays, cycleTime, slaViolation };
    })
    .sort((a, b) => (b.pendingDays || 0) - (a.pendingDays || 0));

  const exportRows = processedData.map((r) => [
    r.sc || '—',
    r.po || '—',
    r.product || '—',
    r.vInfo?.vendorName || r.vInfo?.vendorCode || '—',
    r.currentStage || '—',
    fmtTs(r.timestamp),
    r.pendingDays !== null ? `${r.pendingDays}d` : '—',
    r.cycleTime !== null ? `${r.cycleTime}d` : '—',
    r.slaViolation ? 'VIOLATION' : 'COMPLIANT',
    r.isDone ? 'COMPLETED' : 'IN PROGRESS',
  ]);

  return (
    <div className="table-card" style={{ marginTop: 16 }}>
      <div className="table-header">
        <div className="chart-title">
          Vendor Process Aging & Cycle Time — Item Level (Today Reference)
        </div>
        <TableExportDropdown title="Vendor Item Aging & Cycle Time" headers={headers} rows={exportRows} />
      </div>
      <div style={{ marginTop: 12 }}>
        <VirtualizedTable
          headers={headers}
          data={processedData}
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
                <div style={{ flex: 0.9, padding: '0 12px' }}>
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
                    flex: 1.4,
                    padding: '0 12px',
                    fontSize: 11,
                    maxWidth: 240,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.product || '—'}
                </div>
                <div style={{ flex: 1.1, padding: '0 12px', fontWeight: 700, color: 'var(--accent1)' }}>
                  {r.vInfo ? `${r.vInfo.name} (${r.vInfo.code})` : '—'}
                </div>
                <div style={{ flex: 0.9, padding: '0 12px' }}>
                  <span className="status-pill s-vendor" style={{ fontSize: 10 }}>{r.currentStage || 'UNKNOWN'}</span>
                </div>
                <div className="mono" style={{ flex: 0.9, padding: '0 12px', fontSize: 10 }}>
                  {fmtTs(r.timestamp)}
                </div>
                <div
                  style={{
                    flex: 0.9,
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
                    flex: 0.9,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--accent1)',
                  }}
                >
                  {cycle != null ? `${cycle}d` : '—'}
                </div>
                <div style={{ flex: 0.9, padding: '0 12px' }}>
                  <span className={`status-pill ${r.slaViolation ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 10 }}>
                    {slaStatus}
                  </span>
                </div>
                <div style={{ flex: 0.8, padding: '0 12px' }}>
                  <span className={`status-pill ${overdue ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 10 }}>
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

