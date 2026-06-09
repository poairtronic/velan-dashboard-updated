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
  emptyMessage = 'No data found.'
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
        background: 'rgba(10,25,47,0.4)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
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
          {isEmpty ? (
            <tr>
              <td colSpan={headers ? headers.length : 1} style={{ textAlign: 'center', padding: '40px 0' }}>
                <EmptyState title="No Records Found" description={emptyMessage} />
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
