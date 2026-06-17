import React from 'react';
import { TableSkeleton } from './ui/skeletons/Skeletons';
import EmptyState from './ui/EmptyState';

function DataTable({ 
  headers, 
  children, 
  style, 
  className = 'db-table',
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data found.',
  lightMode = false
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div
      className="table-wrap"
      style={{
        overflowX: 'auto',
        width: '100%',
        background: lightMode ? '#ffffff' : 'rgba(10,25,47,0.4)',
        borderRadius: 8,
        border: lightMode ? '1px solid #e2e8f0' : '1px solid var(--border)',
      }}
    >
      <table className={className} style={{ width: '100%', borderCollapse: 'collapse', ...style }}>
        {headers && (
          <thead style={lightMode ? { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' } : {}}>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={lightMode ? { color: '#475569', fontWeight: 'bold' } : {}}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={headers ? headers.length : 1} style={{ textAlign: 'center', padding: '40px 0', color: lightMode ? '#64748b' : 'inherit' }}>
                <EmptyState title="No Records Found" description={emptyMessage} lightMode={lightMode} />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(DataTable);
