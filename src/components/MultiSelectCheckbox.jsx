import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export default function MultiSelectCheckbox({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = 'Select options',
  searchPlaceholder = 'Search...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => {
      if (prev) setSearchTerm('');
      return !prev;
    });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCheckboxChange = (value) => {
    let newSelected;
    if (selectedValues.includes(value)) {
      newSelected = selectedValues.filter((v) => v !== value);
    } else {
      newSelected = [...selectedValues, value];
    }
    onChange(newSelected);
  };

  const filteredOptions = (options || []).filter((option) => {
    const label = typeof option === 'string' ? option : (option?.label || option?.value || '');
    return String(label).toLowerCase().includes(searchTerm.trim().toLowerCase());
  });

  const handleToggleSelectFiltered = (e) => {
    e.stopPropagation();
    const filteredVals = filteredOptions.map((opt) =>
      typeof opt === 'string' ? opt : opt.value
    );
    const allSelected = filteredVals.every((v) => selectedValues.includes(v));

    if (allSelected) {
      // Deselect only the filtered items
      onChange(selectedValues.filter((v) => !filteredVals.includes(v)));
    } else {
      // Select all filtered items (merge with existing)
      const combined = Array.from(new Set([...selectedValues, ...filteredVals]));
      onChange(combined);
    }
  };

  const displayValue =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
        ? selectedValues[0]
        : `${selectedValues.length} selected`;

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 140 }}>
      <div
        className="filter-select"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
        onClick={toggleDropdown}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayValue}
        </span>
        <span style={{ fontSize: '0.8em', marginLeft: 8 }}>▼</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: 240,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search bar inside the dropdown */}
          <div
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  closeDropdown();
                }
              }}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                padding: '4px 6px',
                fontSize: 11,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent1)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick action bar */}
          {filteredOptions.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 10px',
                fontSize: 10,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.15)',
              }}
            >
              <span>
                {filteredOptions.length} option{filteredOptions.length > 1 ? 's' : ''}
              </span>
              <span
                onClick={handleToggleSelectFiltered}
                style={{
                  cursor: 'pointer',
                  color: 'var(--accent1)',
                  fontWeight: 600,
                  userSelect: 'none',
                }}
              >
                {filteredOptions.every((opt) =>
                  selectedValues.includes(typeof opt === 'string' ? opt : opt.value)
                )
                  ? 'Deselect all'
                  : 'Select all'}
              </span>
            </div>
          )}

          {/* Options list */}
          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '14px 10px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                }}
              >
                No matching options
              </div>
            ) : (
              filteredOptions.map((option, i) => {
                const val = typeof option === 'string' ? option : option.value;
                const label = typeof option === 'string' ? option : option.label;
                const isLast = i === filteredOptions.length - 1;
                const isChecked = selectedValues.includes(val);

                return (
                  <label
                    key={val}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '7px 10px',
                      cursor: 'pointer',
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      fontSize: 12,
                      userSelect: 'none',
                      background: isChecked ? 'rgba(0, 210, 255, 0.06)' : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = isChecked
                        ? 'rgba(0, 210, 255, 0.06)'
                        : 'transparent')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCheckboxChange(val)}
                      style={{ marginRight: 8, cursor: 'pointer', accentColor: 'var(--accent1)' }}
                    />
                    <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
