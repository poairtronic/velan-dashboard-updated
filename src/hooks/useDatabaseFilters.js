import { useState, useMemo } from 'react';
import { normalizeProductsInGroup, getProductCategory } from '../utils/calculationUtils';

export function useDatabaseFilters(rawData) {
  // Compute normalized data once
  const data = useMemo(() => {
    if (!rawData) return [];
    const scGroups = {};
    rawData.forEach((r) => {
      if (!r.sc) return;
      if (!scGroups[r.sc]) scGroups[r.sc] = [];
      scGroups[r.sc].push(r);
    });
    const activeRows = [];
    rawData.forEach((r) => {
      if (!r.sc) {
        activeRows.push(r);
        return;
      }
      const group = scGroups[r.sc] || [];
      const liveRows = group.filter((row) => row._isLive);
      let activePOs = [];
      let activeProducts = [];
      if (liveRows.length > 0) {
        activePOs = [...new Set(liveRows.map((row) => row.po).filter(Boolean))];
        const normalizedLive = normalizeProductsInGroup(liveRows);
        activeProducts = [
          ...new Set(normalizedLive.map((row) => (row.product || '').trim()).filter(Boolean)),
        ];
      } else {
        const sorted = [...group].sort((a, b) => {
          const tA = a.timestamp || a.poDate || '';
          const tB = b.timestamp || b.poDate || '';
          return tB.localeCompare(tA);
        });
        if (sorted[0] && sorted[0].po) {
          activePOs = [sorted[0].po];
        }
      }
      if (!activePOs.includes(r.po)) return;
      if (liveRows.length > 0 && activeProducts.length > 0) {
        const cleanProduct = (r.product || '').trim();
        let productMatch = activeProducts.includes(cleanProduct);
        if (!productMatch) {
          if (cleanProduct.endsWith('...')) {
            const prefix = cleanProduct.slice(0, -3);
            productMatch = activeProducts.some((ap) => ap.startsWith(prefix));
          } else {
            productMatch = activeProducts.some(
              (ap) => ap.endsWith('...') && cleanProduct.startsWith(ap.slice(0, -3))
            );
          }
        }
        if (!productMatch) return;
      } else if (liveRows.length === 0) {
        const activeGroupRows = group.filter((row) => activePOs.includes(row.po));
        const scTimestamps = activeGroupRows.map((row) => row.timestamp).filter(Boolean);
        if (scTimestamps.length > 0) {
          const latestSCTime = new Date(scTimestamps.sort().pop()).getTime();
          const prodRows = activeGroupRows.filter(
            (row) => (row.product || '').trim() === (r.product || '').trim()
          );
          const prodTimestamps = prodRows.map((row) => row.timestamp).filter(Boolean);
          if (prodTimestamps.length > 0) {
            const latestProdTime = new Date(prodTimestamps.sort().pop()).getTime();
            const diffDays = (latestSCTime - latestProdTime) / (1000 * 60 * 60 * 24);
            if (diffDays > 3) {
              return;
            }
          } else {
            return;
          }
        }
      }
      activeRows.push(r);
    });
    return activeRows;
  }, [rawData]);

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

  const filtered = useMemo(() => {
    const result = data.filter((row) => {
      const dateVal = dateType === 'poDate' ? row.poDate : row.timestamp;
      if (!dateInRange(dateVal)) return false;
      if (filters.po && row.po !== filters.po) return false;
      if (filters.stage && (row.currentStage || '').trim() !== filters.stage) return false;
      if (filters.type && row.type !== filters.type) return false;
      if (filters.inhouse && row.inhouse !== filters.inhouse) return false;
      if (filters.category && getProductCategory && getProductCategory(row.type) !== filters.category) return false;
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

    return result.sort((a, b) => {
      const dateA = a.poDate ? new Date(a.poDate).getTime() : 0;
      const dateB = b.poDate ? new Date(b.poDate).getTime() : 0;
      return dateA - dateB;
    });
  }, [data, filters, fromDate, toDate, dateType]);

  const allScItemsModal = useMemo(() => {
    const m = {};
    data.forEach((r) => {
      if (!r.sc) return;
      if (!m[r.sc]) m[r.sc] = [];
      m[r.sc].push(r);
    });
    Object.keys(m).forEach((sc) => {
      m[sc] = normalizeProductsInGroup(m[sc]);
    });
    return m;
  }, [data]);

  const filteredScGroupsModal = useMemo(() => {
    const m = {};
    filtered.forEach((r) => {
      if (!r.sc) return;
      if (!m[r.sc]) m[r.sc] = [];
      m[r.sc].push(r);
    });
    Object.keys(m).forEach((sc) => {
      m[sc] = normalizeProductsInGroup(m[sc]);
    });
    return m;
  }, [filtered]);

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
    data,
    filtered,
    dateType,
    setDateType,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    filters,
    setFilters,
    allScItemsModal,
    filteredScGroupsModal,
    hasNonDateFilter,
    setQuickDays,
    dateInRange,
  };
}
