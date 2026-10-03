import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from './useAsync';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('useAsync target isolation', () => {
  it('removes previous data immediately when the target changes', async () => {
    const next = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }) =>
        useAsync(
          () => (id === 'a' ? Promise.resolve('A') : next.promise),
          [id],
        ),
      { initialProps: { id: 'a' } },
    );
    await waitFor(() => expect(result.current.data).toBe('A'));
    rerender({ id: 'b' });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    await act(async () => next.resolve('B'));
    expect(result.current.data).toBe('B');
  });

  it('ignores late responses even when the loader ignores abort', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }) =>
        useAsync(() => (id === 'a' ? first.promise : second.promise), [id]),
      { initialProps: { id: 'a' } },
    );
    rerender({ id: 'b' });
    await act(async () => second.resolve('B'));
    await act(async () => first.resolve('A'));
    expect(result.current.data).toBe('B');
  });

  it('clears an old error and ignores a cancelled rejection', async () => {
    const pending = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }) =>
        useAsync(
          () => (id === 'a' ? pending.promise : Promise.resolve('B')),
          [id],
        ),
      { initialProps: { id: 'a' } },
    );
    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.data).toBe('B'));
    await act(async () => pending.reject(new Error('Old failure')));
    expect(result.current.error).toBeUndefined();
  });
});
