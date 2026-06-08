import React from 'react';
// ─── DATATABLE UI COMPONENT ───────────────────────────────────────────────────

function DataTable({ headers, children, style, className = 'db-table' }) {
  return (
    <div style={{ overflowX: 'auto', width: '100%', background: 'rgba(10,25,47,0.4)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table className={className} style={{ width: '100%', borderCollapse: 'collapse', ...style }}>
        {headers && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(DataTable);