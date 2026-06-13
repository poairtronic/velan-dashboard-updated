import React from 'react';
import * as ReactWindow from 'react-window';
const FixedSizeList = ReactWindow.FixedSizeList || ReactWindow.default?.FixedSizeList || ReactWindow;
import { TableSkeleton } from './skeletons/Skeletons';
import EmptyState from './EmptyState';

function VirtualizedTable({
  headers,
  data,
  RowComponent,
  itemSize = 55,
  height = 600,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data found.',
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (isEmpty || !data || data.length === 0) {
    return (
      <div
        className="table-wrap"
        style={{
          width: '100%',
          background: 'rgba(10,25,47,0.4)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          padding: '40px 0',
        }}
      >
        <EmptyState title="No Records Found" description={emptyMessage} />
      </div>
    );
  }

  // Row Renderer for react-window
  const RowRenderer = ({ index, style }) => {
    const row = data[index];
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
        className="virt-row"
      >
        <RowComponent row={row} index={index} />
      </div>
    );
  };

  return (
    <div
      className="table-wrap virt-table-wrap"
      style={{
        width: '100%',
        background: 'rgba(10,25,47,0.4)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Fixed Header */}
      {headers && (
        <div
          className="virt-header"
          style={{
            display: 'flex',
            background: 'rgba(2, 12, 27, 0.7)',
            borderBottom: '1px solid var(--border)',
            fontWeight: '600',
            color: 'var(--textSecondary)',
            padding: '12px 0',
          }}
        >
          {headers.map((h, i) => (
            <div key={i} style={{ flex: h.flex || 1, padding: '0 12px' }}>
              {h.label || h}
            </div>
          ))}
        </div>
      )}

      {/* Virtualized Body */}
      <FixedSizeList
        height={height}
        itemCount={data.length}
        itemSize={itemSize}
        width="100%"
      >
        {RowRenderer}
      </FixedSizeList>
    </div>
  );
}

export default React.memo(VirtualizedTable);
