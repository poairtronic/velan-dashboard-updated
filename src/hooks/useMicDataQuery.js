import { useQuery } from '@tanstack/react-query';
import { useFilters } from '../context/FilterContext';
import { apiBase, apiClient } from '../services/apiClient';

export default function useMicDataQuery() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['micData', filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await apiClient(`${apiBase}/api/mic?${qs}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (!res.ok) throw new Error('Failed to fetch MIC data');
      return await res.json();
    },
    refetchInterval: 30000, // 30s
    staleTime: 15000,
  });
}

