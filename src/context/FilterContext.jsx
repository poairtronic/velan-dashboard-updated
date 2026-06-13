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

  // Client-side filterRows removed; filtering is now handled in the backend via React Query.

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      dateRange,
      setDateRange,
      resetFilters,
    }),
    [filters, dateRange, resetFilters]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
}
