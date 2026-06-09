import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '../services/dataService';
import { loadConfig } from '../services/configService';
import { useAuth } from './useAuth';
import { logger } from '../utils/logger';

function useDashboardData(options) {
  const { user } = useAuth();
  const {
    setData,
    setLiveRows,
    setLastSync,
    setServerStatus,
    setIsLoading,
    setLiveConfig,
    setHistoryConfig,
  } = options;

  const { data: serverData, isLoading: isServerDataLoading, isError: isServerDataError, error: serverDataError } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const payload = await fetchData();
      return payload;
    },
    enabled: !!user,
    // Configuration uses default options from queryClient (staleTime 5m)
  });

  React.useEffect(() => {
    if (!user) {
      setData([]);
      setLiveRows([]);
      setLastSync('');
      setServerStatus('loading');
      return;
    }

    setIsLoading(isServerDataLoading);

    if (serverData) {
      setData(Array.isArray(serverData.rows) ? serverData.rows : []);
      setLiveRows(Array.isArray(serverData.liveRows) ? serverData.liveRows : []);
      if (serverData.lastSync) setLastSync(serverData.lastSync);
      setServerStatus('ready');
    }

    if (isServerDataError) {
      logger.error('loadServerData failed:', serverDataError);
      setServerStatus('offline');
      setData([]);
      setLiveRows([]);
    }
  }, [user, serverData, isServerDataLoading, isServerDataError, serverDataError, setData, setLiveRows, setLastSync, setServerStatus, setIsLoading]);

  const { data: serverConfig } = useQuery({
    queryKey: ['serverConfig'],
    queryFn: loadConfig,
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
  });

  React.useEffect(() => {
    if (!user || !serverConfig) return;
    
    if (serverConfig.liveUrl) {
      setLiveConfig((prev) => ({ ...prev, url: prev.url ? prev.url : serverConfig.liveUrl }));
    }
    if (serverConfig.historyUrl) {
      setHistoryConfig((prev) => ({ ...prev, url: prev.url ? prev.url : serverConfig.historyUrl }));
    }
  }, [user, serverConfig, setLiveConfig, setHistoryConfig]);
}

export default useDashboardData;
