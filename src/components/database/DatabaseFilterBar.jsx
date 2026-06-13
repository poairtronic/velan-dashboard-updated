import React, { useMemo } from 'react';

function DatabaseFilterBar({
  dateType,
  setDateType,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  setQuickDays,
  filters,
  setFilters,
  uniquePOs,
  uniqueTypes,
  filteredCount,
  totalCount,
}) {
  return (
    <div className="chart-card" style={{ marginBottom: 16, background: 'var(--bg-card2)' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`filter-btn${dateType === 'poDate' ? ' active' : ''}`}
            onClick={() => setDateType('poDate')}
          >
            PO Received Date
          </button>
          <button
            className={`filter-btn${dateType === 'timestamp' ? ' active' : ''}`}
            onClick={() => setDateType('timestamp')}
          >
            Last Updated Timestamp
          </button>
        </div>
        <input
          type="date"
          className="filter-input"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="From"
        />
        <input
          type="date"
          className="filter-input"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="To"
        />
        <button
          className="filter-btn reset"
          onClick={() => {
            setFromDate('');
            setToDate('');
          }}
        >
          ✕ Reset
        </button>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          <button className="filter-btn" onClick={() => setQuickDays(7)}>
            Last 7 Days
          </button>
          <button className="filter-btn" onClick={() => setQuickDays(14)}>
            Last 14 Days
          </button>
          <button className="filter-btn" onClick={() => setQuickDays(30)}>
            Last 30 Days
          </button>
          <button className="filter-btn" onClick={() => setQuickDays(60)}>
            Last 60 Days
          </button>
          <button className="filter-btn" onClick={() => setQuickDays(90)}>
            Last 90 Days
          </button>
        </div>
      </div>
      <div
        style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <select
          className="filter-select"
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
          className="filter-select"
          value={filters.stage}
          onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
        >
          <option value="">All Stages</option>
          {['STORES', 'STOCK', 'READY'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
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
          className="filter-select"
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">All Categories</option>
          <option value="AIRPLUG">Airplug (APG/ARG)</option>
          <option value="MASTER">Master (SRG/SP/SPG)</option>
          <option value="ACCESSORY">Accessories</option>
        </select>
        <select
          className="filter-select"
          value={filters.inhouse}
          onChange={(e) => setFilters((f) => ({ ...f, inhouse: e.target.value }))}
        >
          <option value="">Inhouse + Vendor</option>
          <option value="INHOUSE">Inhouse Only</option>
          <option value="VENDOR">Vendor Only</option>
        </select>
        <input
          className="filter-input"
          placeholder="Search SC / Product / PO..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          style={{ minWidth: 200 }}
        />
        <button
          className="filter-btn reset"
          onClick={() =>
            setFilters({ po: '', stage: '', type: '', inhouse: '', category: '', search: '' })
          }
        >
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
          {filteredCount} filtered · {totalCount} total
        </span>
      </div>
    </div>
  );
}

export default DatabaseFilterBar;
