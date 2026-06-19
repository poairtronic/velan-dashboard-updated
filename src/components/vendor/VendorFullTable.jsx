import React from 'react';
import calculationUtils from '../../utils/calculationUtils';
const { TARGET_DAYS  } = calculationUtils;
import { fmtTs } from '../../utils/dateUtils';

import VirtualizedTable from '../ui/VirtualizedTable';

function VendorFullTable({ vendors }) {
  return (
    <div className="table-card">
      <div className="table-header">
        <div className="chart-title">Full Vendor Evaluation Table</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <VirtualizedTable
          headers={['VENDOR OP', 'ITEMS', '% SHARE', 'AVG PENDING DAYS', 'MAX PENDING', 'DELAYED (>21d)', 'PROCESS CYCLE', 'EFFICIENCY', 'SLA VIOLATIONS', 'LAST UPDATE', 'RATING', 'SAMPLE PRODUCTS']}
          data={[...vendors].sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0))}
          height={600}
          itemSize={50}
          RowComponent={({ row: v }) => {
            const overdue = (v.avgDays || 0) > TARGET_DAYS;
            const latestTs = v.items
              .map((it) => it.timestamp)
              .filter(Boolean)
              .sort()
              .pop();
            const rating = overdue ? '🔴 SLOW' : (v.avgDays || 0) > 14 ? '🟡 OK' : '🟢 FAST';
            return (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '0 12px' }}>
                  <span className="status-pill s-vendor">{v.code}</span>
                </div>
                <div
                  style={{
                    flex: 1,
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
                        width: 60,
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
                    <span style={{ color: 'var(--accent6)', fontWeight: 700 }}>{v.pct}%</span>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
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
                    color: 'var(--accent1)',
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
                <div style={{ flex: 1, padding: '0 12px', fontSize: 12 }}>{rating}</div>
                <div
                  style={{
                    flex: 1,
                    padding: '0 12px',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    maxWidth: 220,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.items
                    .slice(0, 3)
                    .map((it) => it.product)
                    .join(' · ')}
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

export default React.memo(VendorFullTable);

