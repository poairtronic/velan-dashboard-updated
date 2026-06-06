// ─── INITIAL DATA INITIALIZATION HOOK ─────────────────────────────────────────

function useDashboardData(options) {
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
    async function loadServerData() {
      setIsLoading(true);
      try {
        const payload = await apiFetchData();
        setData(Array.isArray(payload.rows) ? payload.rows : []);
        setLiveRows(Array.isArray(payload.liveRows) ? payload.liveRows : []);
        if (payload.lastSync) setLastSync(payload.lastSync);
        setServerStatus('ready');
      } catch (err) {
        setServerStatus('offline');
        setData([]);
        setLiveRows([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadServerData();
  }, [setData, setLiveRows, setLastSync, setServerStatus, setIsLoading]);

  React.useEffect(() => {
    async function loadServerConfig() {
      try {
        const cfg = await apiLoadConfig();
        if (cfg.liveUrl) {
          setLiveConfig(prev => ({ ...prev, url: prev.url ? prev.url : cfg.liveUrl }));
        }
        if (cfg.historyUrl) {
          setHistoryConfig(prev => ({ url: prev.url ? prev.url : cfg.historyUrl }));
        }
      } catch { /* ignore */ }
    }
    loadServerConfig();
  }, [setLiveConfig, setHistoryConfig]);
}
