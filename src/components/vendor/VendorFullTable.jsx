import React from 'react';
import calculationUtils from '../../utils/calculationUtils.js';
const { TARGET_DAYS } = calculationUtils;
import { fmtTs } from '../../utils/dateUtils';

import VirtualizedTable from '../ui/VirtualizedTable';
import TableExportDropdown from '../TableExportDropdown';

function VendorFullTable({ vendors = [] }) {
  const sortedVendors = [...vendors].sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0));
  const headers = ['VENDOR NAME', 'CODE', 'OPERATION', 'ITEMS', '% SHARE', 'AVG PENDING DAYS', 'MAX PENDING', 'DELAYED (>21d)', 'EFFICIENCY', 'SLA VIOLATIONS', 'LAST UPDATE', 'RATING'];
  const exportRows = sortedVendors.map((v) => {
    const overdue = (v.avgDays || 0) > TARGET_DAYS;
    const latestTs = (v.items || [])
      .map((it) => it.timestamp)
      .filter(Boolean)
      .sort()
      .pop();
    const rating = overdue ? 'SLOW' : (v.avgDays || 0) > 14 ? 'OK' : 'FAST';
    return [
      v.name || v.vendorName || v.code,
      v.code,
      v.operation || 'EXT',
      v.count || v.items?.length || 0,
      v.pct || '—',
      v.avgDays || 0,
      v.maxDays || 0,
      v.delayedCount || 0,
      v.efficiency || '—',
      v.slaViolations || 0,
      fmtTs(latestTs),
      rating,
    ];
  });

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="chart-title">Full Vendor Evaluation Table</div>
        <TableExportDropdown title="Vendor Evaluation Table" headers={headers} rows={exportRows} />
      </div>
      <div style={{ marginTop: 12 }}>
        <VirtualizedTable
          headers={headers}
          data={sortedVendors}
          height={600}
          itemSize={50}
          RowComponent={({ row: v }) => {
            const overdue = (v.avgDays || 0) > TARGET_DAYS;
            const latestTs = (v.items || [])
              .map((it) => it.timestamp)
              .filter(Boolean)
              .sort()
              .pop();
            const rating = overdue ? '🔴 SLOW' : (v.avgDays || 0) > 14 ? '🟡 OK' : '🟢 FAST';
            return (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                <div style={{ flex: 1.4, padding: '0 12px', fontWeight: 700, color: 'var(--accent1)' }}>
                  {v.name || v.vendorName || v.code}
                </div>
                <div style={{ flex: 0.8, padding: '0 12px' }}>
                  <span className="status-pill s-vendor" style={{ fontSize: 11 }}>{v.code}</span>
                </div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span className="status-pill badge-blue" style={{ fontSize: 10 }}>{v.operation || 'EXT'}</span>
                </div>
                <div
                  style={{
                    flex: 0.8,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 18,
                    color: 'var(--accent6)',
                  }}
                >
                  {v.count}
                </div>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 50,
                        height: 7,
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${v.pct}%`,
                          height: '100%',
                          background: '#b24bff',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ color: 'var(--accent6)', fontWeight: 700, fontSize: 12 }}>{v.pct}%</span>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1.1,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 18,
                    color: overdue ? 'var(--danger)' : 'var(--warning)',
                  }}
                >
                  {v.avgDays != null ? `${v.avgDays}d` : '—'}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 16,
                    color: 'var(--accent4)',
                  }}
                >
                  {v.maxDays != null ? `${v.maxDays}d` : '—'}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    color: v.delayed > 0 ? 'var(--danger)' : 'var(--success)',
                    fontWeight: 700,
                    fontFamily: 'Rajdhani',
                    fontSize: 17,
                  }}
                >
                  {v.delayed}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 14,
                    color:
                      v.processEfficiency >= 80
                        ? 'var(--success)'
                        : v.processEfficiency >= 60
                          ? 'var(--warning)'
                          : 'var(--danger)',
                  }}
                >
                  {v.processEfficiency != null ? `${v.processEfficiency}%` : '—'}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 14,
                    color: v.slaViolations > 0 ? 'var(--danger)' : 'var(--success)',
                  }}
                >
                  {v.slaViolations || 0}
                </div>
                <div className="mono" style={{ flex: 1, padding: '0 12px', fontSize: 10, color: 'var(--text-muted)' }}>
                  {fmtTs(latestTs)}
                </div>
                <div style={{ flex: 0.9, padding: '0 12px', fontSize: 12 }}>{rating}</div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

export default React.memo(VendorFullTable);

