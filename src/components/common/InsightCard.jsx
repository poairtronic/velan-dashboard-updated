import React from 'react';

export default function InsightCard({ title, content, icon: Icon, type = 'info', action }) {
  let borderColor = 'var(--accent1)';
  let iconColor = 'var(--accent1)';

  if (type === 'success') {
    borderColor = '#10b981'; // emerald-500
    iconColor = '#10b981';
  } else if (type === 'warning') {
    borderColor = '#f59e0b'; // amber-500
    iconColor = '#f59e0b';
  } else if (type === 'danger') {
    borderColor = '#ef4444'; // red-500
    iconColor = '#ef4444';
  }

  return (
    <div className="card p-5 relative overflow-hidden group transition-all duration-300 hover:shadow-lg" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="p-3 rounded-xl bg-gray-800/50" style={{ color: iconColor }}>
            <Icon size={24} />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-100 mb-2">{title}</h3>
          <div className="text-sm text-gray-400 leading-relaxed">
            {content}
          </div>
          {action && (
            <div className="mt-4">
              {action}
            </div>
          )}
        </div>
      </div>
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"
        style={{ background: `linear-gradient(45deg, transparent, ${borderColor})` }}
      />
    </div>
  );
}
