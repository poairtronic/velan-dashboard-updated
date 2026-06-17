import React from 'react';

export default function EmptyState({ icon = '📭', title = 'No Data Found', description = 'There is currently no data to display here.', actionText, onAction, lightMode = false }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title" style={lightMode ? { color: '#0f172a' } : {}}>{title}</div>
      <div className="empty-state-desc" style={lightMode ? { color: '#64748b' } : {}}>{description}</div>
      {actionText && onAction && (
        <button 
          className="filter-btn active" 
          onClick={onAction}
          style={{ padding: '10px 24px', fontSize: '14px' }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
