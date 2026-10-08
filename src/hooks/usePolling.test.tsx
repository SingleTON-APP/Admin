import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
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
  it('pauses hidden tabs and resumes exactly one request and timer', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('visible');
    const load = vi.fn().mockResolvedValue({ total: 4 });
    renderHook(() => usePolling(load, 5000));
    await act(async () => {});
    visibility.mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    act(() => window.dispatchEvent(new Event('online')));
    expect(load).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('does not auto-refresh manual mode on visibility or online events', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue({ total: 4 });
    const { result } = renderHook(() => usePolling(load, 0));
    await act(async () => {});
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => result.current.refresh());
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('ignores manual and resume triggers while a request is in flight', async () => {
    vi.useFakeTimers();
    let resolve!: (value: number) => void;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(2);
    const { result } = renderHook(() => usePolling(load, 5000));
    act(() => {
      result.current.refresh();
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => resolve(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
