import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getProductCategory } from '../utils/calculationUtils';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState({
    po: '',
    stage: '',
    type: '',
    inhouse: '',
    category: '',
    search: '',
  });

  const [dateRange, setDateRange] = useState({
    from: '',
    to: '',
  });

  const resetFilters = useCallback(() => {
    setFilters({
      po: '',
      stage: '',
      type: '',
      inhouse: '',
      category: '',
      search: '',
    });
    setDateRange({ from: '', to: '' });
  }, []);

  const filterRows = useCallback(
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

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      dateRange,
      setDateRange,
      resetFilters,
      filterRows,
    }),
    [filters, dateRange, resetFilters, filterRows]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
}
