import { useQuery } from '@tanstack/react-query';
import { apiBase, apiClient } from '../services/apiClient';

export function useProductionDataQuery(filters, page = 1, limit = 100) {
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
    params.append('page', page);
    params.append('limit', limit);
    return params.toString();
  };

  const queryString = buildQueryString(filters);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['productionData', filters, page, limit],
    queryFn: async () => {
      const res = await apiClient(`${apiBase}/api/data/production?${queryString}`, {
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

  return {
    rows: data?.rows || [],
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
    page: data?.page || 1,
    limit: data?.limit || 100,
    isLoading,
    isFetching,
    isError
  };
}
