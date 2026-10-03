import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueueAutoRefresh } from './useQueueAutoRefresh';
describe('queue auto refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('is opt-in and requests only once per minute', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useQueueAutoRefresh(enabled, false, refresh),
      { initialProps: { enabled: false } },
    );
    act(() => vi.advanceTimersByTime(120000));
    expect(refresh).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(59999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('never requests in hidden tabs, resumes after visibility returns', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    const refresh = vi.fn();
    renderHook(() => useQueueAutoRefresh(true, false, refresh));
    act(() => vi.advanceTimersByTime(180000));
    expect(refresh).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    act(() => vi.advanceTimersByTime(60000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('does not overlap a load and stops after unmount', () => {
    const refresh = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ loading }) => useQueueAutoRefresh(true, loading, refresh),
      { initialProps: { loading: false } },
    );
    rerender({ loading: true });
    act(() => vi.advanceTimersByTime(120000));
    expect(refresh).not.toHaveBeenCalled();
    rerender({ loading: false });
    act(() => vi.advanceTimersByTime(60000));
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    act(() => vi.advanceTimersByTime(180000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
