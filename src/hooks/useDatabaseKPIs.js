import { useDatabaseKpisQuery } from './queries/useDashboardQueries';

export function useDatabaseKPIs(filters) {
  const { data: res } = useDatabaseKpisQuery(filters);
  const kpis = res?.data || {
    total: 0,
    uniquePO: 0,
    uniqueSC: 0,
    readyItemsCount: 0,
    scCompleted: 0,
    scCompletedPlusVA: 0,
    vaBreakdown: { READY: 0, STOCK: 0, STORES: 0, EXSTOCK: 0, VA: 0 },
    scReceived: 0,
    scReady: 0,
    scSetsReceived: 0,
    scSetsCompleted: 0,
    scSetsCompletedTotal: 0
  };

  const isDoneStage = (s) => {
    if (!s) return false;
    const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
    if (t === 'READY') return true;
    if (t === 'STORES') return true;
    if (t === 'STOCK') return true;
    if (t === 'EXSTOCK') return true;
    if (t === 'VA') return true;
    if (/^STOCK[K]?$/.test(t)) return true;
    if (/^READ{1,2}Y$/.test(t)) return true;
    if (t === 'STORE') return true;
    return false;
  };

  return { ...kpis, isDoneStage };
}
