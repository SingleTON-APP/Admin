import { useEffect, useState } from 'react';

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
) {
  const [state, setState] = useState<{
    dependencies: readonly unknown[];
    data?: T;
    loading: boolean;
    error?: string;
  }>({ dependencies: [...deps], loading: true });
  const changed =
    state.dependencies.length !== deps.length ||
    deps.some(
      (dependency, index) => !Object.is(dependency, state.dependencies[index]),
    );
  // Reset during render so children never receive another target's data or
  // action controls for even one frame while the next request starts.
  if (changed) setState({ dependencies: [...deps], loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const dependencies = [...deps];
    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ dependencies, data, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            dependencies,
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
  return changed ? { loading: true, data: undefined, error: undefined } : state;
}
