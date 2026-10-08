import { useCallback, useEffect, useState } from 'react';

/** Schedule after completion: slow requests never overlap or discard the last snapshot. */
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
    updatedAt?: number;
  }>({ loading: true });
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const run = async () => {
      if (running || controller.signal.aborted) return;
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
        if (intervalMs > 0 && !controller.signal.aborted)
          timer = setTimeout(() => void run(), intervalMs);
      }
    };
    const online = () => {
      clearTimeout(timer);
      void run();
    };
    window.addEventListener('online', online);
    void run();
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener('online', online);
    };
  }, [load, intervalMs, revision]);
  return { ...state, refresh };
}
