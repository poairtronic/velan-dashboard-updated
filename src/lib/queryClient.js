import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
      cacheTime: 15 * 60 * 1000, // Cache data for 15 minutes before garbage collection
      retry: 2, // Retry failed requests twice before failing
      refetchOnWindowFocus: true, // Refetch when the user comes back to the dashboard
      refetchOnReconnect: true, // Refetch when network connection is restored
    },
    mutations: {
      retry: 1, // Only retry mutations once, as they can be non-idempotent
    }
  },
});
