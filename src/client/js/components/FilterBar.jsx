import React from 'react';
import { useDashboard } from '../context/DashboardContext';
// ─── FILTERBAR UI COMPONENT ───────────────────────────────────────────────────

function FilterBar() {
  const {
    activeNav,
    filters,
    setFilters,
    uniquePOs,
    uniqueStages,
    uniqueTypes,
    filtered,
    liveData,
    data,
    resetFilters,
  } = useDashboard();

  if (activeNav === 'database' || activeNav === 'upload') {
    return null;
  }

  return (
    <div className="filter-bar">
      <div className="filter-label">FILTERS</div>
      
      <select
        className="filter-select"
        value={filters.po}
        onChange={e => setFilters(f => ({ ...f, po: e.target.value }))}
      >
        <option value="">All POs</option>
        {uniquePOs.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.stage}
        onChange={e => setFilters(f => ({ ...f, stage: e.target.value }))}
      >
        <option value="">All Stages</option>
        {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.type}
        onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
      >
        <option value="">All Types</option>
        {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.category}
        onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
      >
        <option value="">All Categories</option>
        <option value="AIRPLUG">Airplug (APG/ARG)</option>
        <option value="MASTER">Master (SRG/SP/SPG)</option>
        <option value="ACCESSORY">Accessories</option>
      </select>

      <select
        className="filter-select"
        value={filters.inhouse}
        onChange={e => setFilters(f => ({ ...f, inhouse: e.target.value }))}
      >
        <option value="">Inhouse + Vendor</option>
        <option value="INHOUSE">Inhouse Only</option>
        <option value="VENDOR">Vendor Only</option>
      </select>

      <input
        className="filter-input"
        placeholder="Search SC / Product / PO..."
        value={filters.search}
        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        style={{ minWidth: 200 }}
      />

      <button className="filter-btn reset" onClick={resetFilters}>✕ Reset</button>
      
      <span style={{
        marginLeft: 'auto',
        fontFamily: 'Share Tech Mono',
        fontSize: 11,
        color: 'var(--text-muted)'
      }}>
        {filtered.length} items · {liveData.length} live · {data.length} db
      </span>
    </div>
  );
}

export default FilterBar;