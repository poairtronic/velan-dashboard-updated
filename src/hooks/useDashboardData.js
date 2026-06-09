import React from 'react';
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

  React.useEffect(() => {
    if (!user) {
      setData([]);
      setLiveRows([]);
      setLastSync('');
      setServerStatus('loading');
      return;
    }

    async function loadServerData() {
      setIsLoading(true);
      try {
        const payload = await fetchData();
        setData(Array.isArray(payload.rows) ? payload.rows : []);
        setLiveRows(Array.isArray(payload.liveRows) ? payload.liveRows : []);
        if (payload.lastSync) setLastSync(payload.lastSync);
        setServerStatus('ready');
      } catch (err) {
        logger.error('loadServerData failed:', err);
        setServerStatus('offline');
        setData([]);
        setLiveRows([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadServerData();
  }, [user, setData, setLiveRows, setLastSync, setServerStatus, setIsLoading]);

  React.useEffect(() => {
    if (!user) return;
    async function loadServerConfig() {
      try {
        const cfg = await loadConfig();
        if (cfg.liveUrl) {
          setLiveConfig(prev => ({ ...prev, url: prev.url ? prev.url : cfg.liveUrl }));
        }
        if (cfg.historyUrl) {
          setHistoryConfig(prev => ({ ...prev, url: prev.url ? prev.url : cfg.historyUrl }));
        }
      } catch { /* ignore */ }
    }
    loadServerConfig();
  }, [user, setLiveConfig, setHistoryConfig]);
}

export default useDashboardData;