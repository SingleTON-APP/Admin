import { useCallback, useEffect, useRef, useState } from 'react';

/** Schedule after completion: slow requests never overlap or discard the last snapshot. */
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
) {
  const requestRefresh = useRef<() => void>(() => {});
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
    updatedAt?: number;
  }>({ loading: true });
  const refresh = useCallback(() => requestRefresh.current(), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const run = async () => {
      if (running || controller.signal.aborted) return;
      clearTimeout(timer);
      running = true;
      setState((previous) => ({ ...previous, loading: true }));
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted)
          setState({ data, loading: false, updatedAt: Date.now() });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Не удалось обновить данные',
          }));
      } finally {
        running = false;
        if (
          intervalMs > 0 &&
          !controller.signal.aborted &&
          document.visibilityState === 'visible'
        )
          timer = setTimeout(() => void run(), intervalMs);
      }
    };
    const resume = () => {
      if (intervalMs > 0 && document.visibilityState === 'visible') void run();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') clearTimeout(timer);
      else resume();
    };
    requestRefresh.current = () => void run();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', visibility);
    if (intervalMs === 0 || document.visibilityState === 'visible') void run();
    return () => {
      controller.abort();
      clearTimeout(timer);
      requestRefresh.current = () => {};
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [load, intervalMs]);
  return { ...state, refresh };
}
