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

  function dateInRange(val) {
    if (!val) return true;
    const d = val.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  }

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

  return {
    dateType,
    setDateType,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    filters,
    setFilters,
    hasNonDateFilter,
    setQuickDays,
    dateInRange,
  };
}
