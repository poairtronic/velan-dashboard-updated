import { useQuery } from '@tanstack/react-query';
import { apiBase, apiClient } from '../services/apiClient';

export function useBackendKPIs(filtered, scGroups, poGroups, todayStr) {
  // Use React Query to fetch calculated data from the backend
  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ['backendKPIs', todayStr, filtered.length, scGroups.length, poGroups.length],
    queryFn: async () => {
      // If there's no data to process, return default structure immediately
      if (!filtered || filtered.length === 0) return getDefaultKPIs();

      const res = await apiClient(`${apiBase}/api/dashboard/calculations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filtered,
          scGroups,
          poGroups,
          todayStr,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    // Prevent refetching on window focus to save bandwidth
    refetchOnWindowFocus: false,
    staleTime: 60000, // Cache for 1 minute
    keepPreviousData: true, // Keep showing old data while fetching new
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
