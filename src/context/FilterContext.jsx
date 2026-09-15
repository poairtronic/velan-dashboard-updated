import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getProductCategory, getVendorInfo } from '../utils/calculationUtils.js';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState({
    po: '',
    stage: [],
    type: '',
    inhouse: '',
    vendor: '',
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
      stage: [],
      type: '',
      inhouse: '',
      vendor: '',
      category: '',
      search: '',
    });
    setDateRange({ from: '', to: '' });
  }, []);

  const filterRows = useCallback(
    (rows) => {
      return (rows || []).filter((row) => {
        if (filters.po && row.po !== filters.po) return false;
        if (filters.stage && filters.stage.length > 0 && !filters.stage.includes(row.currentStage)) return false;
        if (filters.type && row.type !== filters.type) return false;
        if (filters.inhouse) {
          const isVen = getVendorInfo(row) !== null || row.inhouse === 'VENDOR';
          if (filters.inhouse === 'VENDOR' && !isVen) return false;
          if (filters.inhouse === 'INHOUSE' && isVen) return false;
        }
        if (filters.vendor) {
          const vInfo = getVendorInfo(row);
          const target = filters.vendor.trim().toUpperCase();
          if (
            !vInfo ||
            (vInfo.code.toUpperCase() !== target &&
              vInfo.name.toUpperCase() !== target &&
              vInfo.fullName.toUpperCase() !== target)
          ) {
            return false;
          }
        }
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
