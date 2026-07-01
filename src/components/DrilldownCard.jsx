import React, { useState } from 'react';
import DrilldownModal from './DrilldownModal';

function DrilldownCard({ kpiType, title, children, style = {} }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className="kpi-card drilldown-card"
        onClick={() => setIsOpen(true)}
        style={{ 
          cursor: 'pointer', 
          transition: 'transform 0.2s', 
          position: 'relative',
          ...style 
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        {children}
      </div>

      {isOpen && (
        <DrilldownModal 
          kpiType={kpiType} 
          title={title} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}

export default React.memo(DrilldownCard);

