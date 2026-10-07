import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

afterEach(() => vi.useRealTimers());
describe('monitor polling', () => {
  it('keeps the last snapshot during failures and recovers on the next update', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce({ total: 4 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ total: 8 });
    const { result } = renderHook(() => usePolling(load, 5000));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data).toEqual({ total: 4 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.data).toEqual({ total: 4 });
    expect(result.current.error).toBe('offline');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.data).toEqual({ total: 8 });
    expect(result.current.error).toBeUndefined();
  });
  it('does not overlap a slow request and aborts it on unmount', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const load = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<never>(() => {});
    });
    const { unmount } = renderHook(() => usePolling(load, 5000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(load).toHaveBeenCalledTimes(1);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
