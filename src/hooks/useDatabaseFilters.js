import { useState } from 'react';

export function useDatabaseFilters() {
  const [dateType, setDateType] = useState('poDate');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filters, setFilters] = useState({
    po: '',
    stage: '',
    type: '',
    inhouse: '',
    category: '',
    search: '',
  });

  const hasNonDateFilter = !!(
    filters.po ||
    filters.search ||
    filters.type ||
    filters.inhouse ||
    filters.category ||
    filters.stage
  );

  function setQuickDays(days) {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to);
  }

  // We return a compiled 'activeFilters' object that can be passed directly to React Query
  const activeFilters = {
    ...filters,
    dateType,
    dateFrom: fromDate,
    dateTo: toDate
  };

  return {
    dateType,
    setDateType,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    filters,
    setFilters,
    activeFilters,
    hasNonDateFilter,
    setQuickDays,
    // Mock empty arrays to prevent crashes in legacy code until fully refactored
    data: [],
    filtered: [],
    allScItemsModal: {},
    filteredScGroupsModal: {}
  };
}
