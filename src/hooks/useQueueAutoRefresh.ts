import { useEffect } from 'react';
/** No requests while hidden, during an existing load, or after unmount/logout. */
export function useQueueAutoRefresh(
  enabled: boolean,
  loading: boolean,
  refresh: () => void,
) {
  useEffect(() => {
    if (!enabled || loading) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, loading, refresh]);
}
