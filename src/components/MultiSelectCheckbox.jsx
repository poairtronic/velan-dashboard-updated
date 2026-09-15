import { useState, useRef, useEffect } from 'react';

export default function MultiSelectCheckbox({ options, selectedValues, onChange, placeholder = 'Select options' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCheckboxChange = (value) => {
    let newSelected;
    if (selectedValues.includes(value)) {
      newSelected = selectedValues.filter((v) => v !== value);
    } else {
      newSelected = [...selectedValues, value];
    }
    onChange(newSelected);
  };

  const displayValue = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues.length} selected`;

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 140 }}>
      <div 
        className="filter-select"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayValue}</span>
        <span style={{ fontSize: '0.8em', marginLeft: 8 }}>▼</span>
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          zIndex: 100,
          maxHeight: 250,
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          {options.map((option, i) => {
            const val = typeof option === 'string' ? option : option.value;
            const label = typeof option === 'string' ? option : option.label;
            const isLast = i === options.length - 1;
            return (
              <label 
                key={val} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 12px', 
                  cursor: 'pointer',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  fontSize: 12
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <input 
                  type="checkbox"
                  checked={selectedValues.includes(val)}
                  onChange={() => handleCheckboxChange(val)}
                  style={{ marginRight: 8, cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-primary)' }}>{label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
