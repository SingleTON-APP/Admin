import { useEffect, useState } from 'react';

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
) {
  const [state, setState] = useState<{
    data?: T;
    loading: boolean;
    error?: string;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal)
      .then((data) => setState({ data, loading: false }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Не удалось загрузить данные',
          });
      });
    return () => controller.abort();
    // Loader identities are intentionally represented by explicit deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
