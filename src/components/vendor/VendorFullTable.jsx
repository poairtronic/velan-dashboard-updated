import React from 'react';
import calculationUtils from '../../utils/calculationUtils';
const { TARGET_DAYS  } = calculationUtils;
import { fmtTs } from '../../utils/dateUtils';

function VendorFullTable({ vendors }) {
  return (
    <div className="table-card">
      <div className="table-header">
        <div className="chart-title">Full Vendor Evaluation Table</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>VENDOR OP</th>
              <th>ITEMS</th>
              <th>% SHARE</th>
              <th>AVG PENDING DAYS</th>
              <th>MAX PENDING</th>
              <th>DELAYED (&gt;21d)</th>
              <th>PROCESS CYCLE</th>
              <th>EFFICIENCY</th>
              <th>SLA VIOLATIONS</th>
              <th>LAST UPDATE</th>
              <th>RATING</th>
              <th>SAMPLE PRODUCTS</th>
            </tr>
          </thead>
          <tbody>
            {[...vendors]
              .sort((a, b) => (b.avgDays || 0) - (a.avgDays || 0))
              .map((v, i) => {
                const overdue = (v.avgDays || 0) > TARGET_DAYS;
                const latestTs = v.items
                  .map((it) => it.timestamp)
                  .filter(Boolean)
                  .sort()
                  .pop();
                const rating = overdue ? '🔴 SLOW' : (v.avgDays || 0) > 14 ? '🟡 OK' : '🟢 FAST';
                return (
                  <tr key={i}>
                    <td>
                      <span className="status-pill s-vendor">{v.code}</span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 18,
                        color: 'var(--accent6)',
                      }}
                    >
                      {v.count}
                    </td>
                    <td>
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
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 18,
                        color: overdue ? 'var(--danger)' : 'var(--warning)',
                      }}
                    >
                      {v.avgDays != null ? `${v.avgDays}d` : '—'}
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 16,
                        color: 'var(--accent4)',
                      }}
                    >
                      {v.maxDays != null ? `${v.maxDays}d` : '—'}
                    </td>
                    <td
                      style={{
                        color: v.delayed > 0 ? 'var(--danger)' : 'var(--success)',
                        fontWeight: 700,
                        fontFamily: 'Rajdhani',
                        fontSize: 17,
                      }}
                    >
                      {v.delayed}
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--accent1)',
                      }}
                    >
                      {v.avgDays != null ? `${v.avgDays}d` : '—'}
                    </td>
                    <td
                      style={{
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
                    </td>
                    <td
                      style={{
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 14,
                        color: v.slaViolations > 0 ? 'var(--danger)' : 'var(--success)',
                      }}
                    >
                      {v.slaViolations || 0}
                    </td>
                    <td className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {fmtTs(latestTs)}
                    </td>
                    <td style={{ fontSize: 12 }}>{rating}</td>
                    <td
                      style={{
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

export default VendorFullTable;
