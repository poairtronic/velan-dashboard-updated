import React from 'react';
import { useAuth } from './useAuth';
// ─── LIVE OPERATIONAL SHEET BACKGROUND SYNC HOOK ──────────────────────────────

function useLiveSync(liveConfig, syncLiveDataNow) {
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) return;
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
  }, [user, liveConfig?.enabled, liveConfig?.url, liveConfig?.intervalSec, syncLiveDataNow]);
}

export default useLiveSync;