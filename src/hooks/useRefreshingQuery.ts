import { useEffect, useState } from 'react';

/** Keep a snapshot only while refreshing the same query, never across targets. */
export function useRefreshingQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  queryKey: string,
  revision: number,
) {
  const [state, setState] = useState<{
    queryKey: string;
    revision: number;
    data?: T;
    loading: boolean;
    error?: string;
    updatedAt?: number;
  }>({ queryKey, revision, loading: true });
  const changed = state.queryKey !== queryKey;
  const refreshing = state.revision !== revision;
  if (changed) setState({ queryKey, revision, loading: true });
  else if (refreshing)
    setState({ ...state, revision, loading: true, error: undefined });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setState({
            queryKey,
            revision,
            data,
            loading: false,
            updatedAt: Date.now(),
          });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Не удалось обновить очередь',
          }));
      },
    );
    return () => controller.abort();
    // The caller explicitly identifies the query and refresh revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, revision]);
  return changed
    ? { loading: true, data: undefined, error: undefined, updatedAt: undefined }
    : state;
}
