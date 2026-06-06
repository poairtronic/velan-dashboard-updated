// ─── LIVE OPERATIONAL SHEET BACKGROUND SYNC HOOK ──────────────────────────────

function useLiveSync(liveConfig, syncLiveDataNow) {
  React.useEffect(() => {
    const enabled = liveConfig?.enabled === true;
    const url = String(liveConfig?.url || '').trim();
    if (!enabled || !url) return;

    const sec = Math.max(30, Number(liveConfig.intervalSec) || 300);
    // Initial sync
    syncLiveDataNow(url);

    // Setup periodic polling interval
    const timer = setInterval(() => {
      syncLiveDataNow(url);
    }, sec * 1000);

    return () => clearInterval(timer);
  }, [liveConfig?.enabled, liveConfig?.url, liveConfig?.intervalSec, syncLiveDataNow]);
}
