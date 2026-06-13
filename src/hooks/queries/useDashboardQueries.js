import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient';

export function buildQueryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  }
  return query.toString();
}

export function useDashboardDataQuery(filters, page = 1, limit = 100) {
  return useQuery({
    queryKey: ['dashboard', page, limit, filters],
    queryFn: async () => {
      const qs = buildQueryString({ ...filters, page, limit });
      const res = await apiClient(`/api/data?${qs}`);
      return res;
    },
    keepPreviousData: true,
    staleTime: 60000, // 1 minute
  });
}

export function useKpisQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'summary', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/summary?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useFilterOptionsQuery() {
  return useQuery({
    queryKey: ['kpis', 'filter-options'],
    queryFn: async () => {
      const res = await apiClient(`/api/kpis/filter-options`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useBottlenecksQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'bottlenecks', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/bottlenecks?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useVendorsQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'vendors', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/vendors?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useCycleTimeQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'cycletime', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/cycle-time?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useScGroupsQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'sc-groups', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/sc-groups?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function usePoGroupsQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'po-groups', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/po-groups?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useDatabaseKpisQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'database-stats', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/database-stats?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

export function useProductionKpisQuery(filters) {
  return useQuery({
    queryKey: ['kpis', 'production-stats', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await apiClient(`/api/kpis/production-stats?${qs}`);
      return res;
    },
    staleTime: 60000,
  });
}

