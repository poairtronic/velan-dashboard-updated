import { useQuery } from '@tanstack/react-query';
import { useFilters } from '../context/FilterContext';

export default function useMicDataQuery() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['micData', filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/mic?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch MIC data');
      return res.json();
    },
    refetchInterval: 30000, // 30s
    staleTime: 15000,
  });
}
