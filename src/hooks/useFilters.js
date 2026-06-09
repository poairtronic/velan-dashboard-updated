import React from 'react';
import { getProductCategory } from '../utils/calculationUtils';
// ─── FILTER HOOK ─────────────────────────────────────────────────────────────

function useFilters() {
  const [filters, setFilters] = React.useState({
    po: '',
    stage: '',
    type: '',
    inhouse: '',
    category: '',
    search: '',
  });

  const [dateRange, setDateRange] = React.useState({
    from: '',
    to: '',
  });

  const resetFilters = React.useCallback(() => {
    setFilters({
      po: '',
      stage: '',
      type: '',
      inhouse: '',
      category: '',
      search: '',
    });
  }, []);

  const filterRows = React.useCallback(
    (rows) => {
      return rows.filter((row) => {
        if (filters.po && row.po !== filters.po) return false;
        if (filters.stage && row.currentStage !== filters.stage) return false;
        if (filters.type && row.type !== filters.type) return false;
        if (filters.inhouse && row.inhouse !== filters.inhouse) return false;
        if (filters.category && getProductCategory(row.type) !== filters.category) return false;
        if (filters.search) {
          const s = filters.search.trim().toLowerCase();
          const scStr = String(row.sc || '').toLowerCase();
          const poStr = String(row.po || '').toLowerCase();
          const prodStr = String(row.product || '').toLowerCase();
          const scMatch = scStr === s || scStr.startsWith(s);
          const poMatch = poStr.includes(s);
          const prodMatch = prodStr.includes(s);
          if (!scMatch && !prodMatch && !poMatch) return false;
          if (!scMatch && !prodMatch && poMatch) {
            if (!scStr.startsWith(s)) return false;
          }
        }
        return true;
      });
    },
    [filters]
  );

  return {
    filters,
    setFilters,
    dateRange,
    setDateRange,
    resetFilters,
    filterRows,
  };
}

export default useFilters;
