import React from 'react';
import debounce from 'lodash/debounce';
import { useFilters } from '../context/FilterContext';
import { useData } from '../context/DataContext';
import { useUI } from '../context/UIContext';
// ─── FILTERBAR UI COMPONENT ───────────────────────────────────────────────────

function FilterBar() {
  const { filters, setFilters, resetFilters } = useFilters();
  const { uniquePOs, uniqueStages, uniqueTypes, filtered, liveData, data } = useData();
  const { activeNav } = useUI();

  // Local state tracks raw input value for instant visual feedback
  const [searchInput, setSearchInput] = React.useState(filters.search);

  // Debounced function: only commits the search term to context after 300ms idle
  const debouncedSearch = React.useMemo(
    () =>
      debounce((value) => {
        setFilters((f) => ({ ...f, search: value }));
      }, 300),
    [setFilters]
  );

  // Cancel pending debounce calls on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Keep local input in sync when external reset clears filters
  React.useEffect(() => {
    if (filters.search === '') {
      setSearchInput('');
    }
  }, [filters.search]);

  const handleSearchChange = React.useCallback(
    (e) => {
      const value = e.target.value;
      setSearchInput(value); // instant — updates input display
      debouncedSearch(value); // debounced — triggers filter computation
    },
    [debouncedSearch]
  );

  const handleReset = React.useCallback(() => {
    debouncedSearch.cancel(); // discard any pending debounce
    setSearchInput(''); // clear local input state
    resetFilters(); // clear all context filters
  }, [debouncedSearch, resetFilters]);

  if (activeNav === 'database' || activeNav === 'upload') {
    return null;
  }

  return (
    <div className="filter-bar">
      <div className="filter-label">FILTERS</div>

      <select
        id="filter-po"
        name="filter-po"
        className="filter-select"
        aria-label="Filter by PO"
        value={filters.po}
        onChange={(e) => setFilters((f) => ({ ...f, po: e.target.value }))}
      >
        <option value="">All POs</option>
        {uniquePOs.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        id="filter-stage"
        name="filter-stage"
        className="filter-select"
        aria-label="Filter by Stage"
        value={filters.stage}
        onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
      >
        <option value="">All Stages</option>
        {uniqueStages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        id="filter-type"
        name="filter-type"
        className="filter-select"
        aria-label="Filter by Type"
        value={filters.type}
        onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
      >
        <option value="">All Types</option>
        {uniqueTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        id="filter-category"
        name="filter-category"
        className="filter-select"
        aria-label="Filter by Category"
        value={filters.category}
        onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
      >
        <option value="">All Categories</option>
        <option value="AIRPLUG">Airplug (APG/ARG)</option>
        <option value="MASTER">Master (SRG/SP/SPG)</option>
        <option value="ACCESSORY">Accessories</option>
      </select>

      <select
        id="filter-inhouse"
        name="filter-inhouse"
        className="filter-select"
        aria-label="Filter by Inhouse or Vendor"
        value={filters.inhouse}
        onChange={(e) => setFilters((f) => ({ ...f, inhouse: e.target.value }))}
      >
        <option value="">Inhouse + Vendor</option>
        <option value="INHOUSE">Inhouse Only</option>
        <option value="VENDOR">Vendor Only</option>
      </select>

      <input
        id="filter-search"
        name="filter-search"
        className="filter-input"
        aria-label="Search"
        placeholder="Search SC / Product / PO..."
        value={searchInput}
        onChange={handleSearchChange}
        style={{ minWidth: 200 }}
      />

      <button className="filter-btn reset" onClick={handleReset}>
        ✕ Reset
      </button>

      <span
        style={{
          marginLeft: 'auto',
          fontFamily: 'Share Tech Mono',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        {filtered.length} items · {liveData.length} live · {data.length} db
      </span>
    </div>
  );
}

export default React.memo(FilterBar);
