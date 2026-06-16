import { useQuery } from '@tanstack/react-query';
import { apiBase, apiClient } from '../services/apiClient';

export function useBackendKPIs(filters) {
  // Construct query string from filters
  const buildQueryString = (f) => {
    const params = new URLSearchParams();
    if (f.po) params.append('po', f.po);
    if (f.stage) params.append('stage', f.stage);
    if (f.type) params.append('type', f.type);
    if (f.inhouse) params.append('inhouse', f.inhouse);
    if (f.category) params.append('category', f.category);
    if (f.search) params.append('search', f.search);
    if (f.fromDate) params.append('fromDate', f.fromDate);
    if (f.toDate) params.append('toDate', f.toDate);
    if (f.dateType) params.append('dateType', f.dateType);
    if (f.source) params.append('source', f.source);
    return params.toString();
  };

  const queryString = buildQueryString(filters);

  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ['backendKPIs', filters],
    queryFn: async () => {
      const res = await apiClient(`${apiBase}/api/dashboard/calculations?${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 60000, 
    keepPreviousData: true,
  });

  return kpis || getDefaultKPIs();
}

function getDefaultKPIs() {
  return {
    totalItems: 0,
    ready: 0,
    stores: 0,
    wip: 0,
    inhouse: 0,
    vendor: 0,
    onTime: 0,
    delayed: 0,
    onTimePct: 0,
    totalPOs: 0,
    stageCounts: {},
    stageWIP: {},
    bottleneck: [],
    bottleneckStages: [],
    topBottleneck: null,
    vendors: [],
    vendorTotal: 0,
    vendorStats: {},
    topVendorBottleneck: null,
    stageCycleTimes: [],
    stageAvgToReach: {},
    avgOverallCycle: null,
    scCompletion: [],
    scDailyOutput: [],
    completeSets: [],
    storeSets: [],
    readySets: [],
    delayedPOs: [],
    onTimePOs: [],
    dailyOutput: {},
    dailyOutputArray: [],
  };
}
