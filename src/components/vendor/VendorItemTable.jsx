import React from 'react';
import { TARGET_DAYS, calculateProcessCycleTime, daysBetween } from '../../utils/calculationUtils';
import { fmtTs } from '../../utils/dateUtils';

function VendorItemTable({ data, todayRef, selectedItem, setSelectedItem, setSelectedSC }) {
  return (
    <div className="table-card" style={{ marginTop: 16 }}>
      <div className="table-header">
        <div className="chart-title">
          Vendor Process Aging & Cycle Time — Item Level (Today Reference)
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SC</th>
              <th>PO</th>
              <th>PRODUCT</th>
              <th>PROCESS</th>
              <th>LAST UPDATE</th>
              <th>PENDING DAYS</th>
              <th>CYCLE TIME</th>
              <th>SLA STATUS</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((r) => r.inhouse === 'VENDOR')
              .map((r) => {
                const pendingDays = daysBetween(r.timestamp, todayRef);
                const cycleTime = calculateProcessCycleTime(r.poDate, r.timestamp);
                const slaViolation = pendingDays !== null && pendingDays > 2;
                return { ...r, pendingDays, cycleTime, slaViolation };
              })
              .sort((a, b) => (b.pendingDays || 0) - (a.pendingDays || 0))
              .slice(0, 300)
              .map((r, i) => {
                const pending = r.pendingDays;
                const cycle = r.cycleTime;
                const overdue = pending != null && pending > TARGET_DAYS;
                const slaStatus = r.slaViolation ? 'VIOLATION' : 'COMPLIANT';
                return (
                  <tr
                    key={`${r.sc || '—'}-${r.po}-${i}`}
                    onClick={() => setSelectedItem(r)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedItem === r ? 'rgba(255,107,53,0.08)' : 'transparent',
                    }}
                    title="Click to view item details"
                  >
                    <td>
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
                    </td>
                    <td style={{ fontSize: 11 }}>{r.po || '—'}</td>
                    <td
                      style={{
                        fontSize: 11,
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.product || '—'}
                    </td>
                    <td>
                      <span className="status-pill s-vendor">{r.currentStage || 'UNKNOWN'}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {fmtTs(r.timestamp)}
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 14,
                        color: overdue ? 'var(--danger)' : 'var(--success)',
                      }}
                    >
                      {pending != null ? `${pending}d` : '—'}
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--accent1)',
                      }}
                    >
                      {cycle != null ? `${cycle}d` : '—'}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${r.slaViolation ? 'badge-red' : 'badge-green'}`}
                      >
                        {slaStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${overdue ? 'badge-red' : 'badge-green'}`}>
                        {overdue ? 'DELAYED' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default VendorItemTable;
