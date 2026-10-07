import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ACCESS_EXPIRED, request, setAdminCsrf } from './client';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setAdminCsrf('');
});
describe('Admin CSRF client', () => {
  it('uses the same-origin API by default instead of the visitor localhost', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await request('/admin/auth/session');
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/auth/session',
      expect.any(Object),
    );
  });
  it('sends CSRF on writes with credential cookie, never persistent storage', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    setAdminCsrf('ephemeral-csrf');
    await request('/admin/auth/staff', { method: 'POST', body: '{}' });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Admin-CSRF': 'ephemeral-csrf' }),
      }),
    );
    expect(localStorage.getItem('ephemeral-csrf')).toBeNull();
  });
  it('expires private access on 401 but preserves it on role-denied 403', async () => {
    const listener = vi.fn();
    window.addEventListener(ADMIN_ACCESS_EXPIRED, listener);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    await expect(request('/admin/reports')).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
    await expect(request('/admin/reports')).rejects.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ADMIN_ACCESS_EXPIRED, listener);
  });
  it.each([
    '/admin/auth/staff',
    '/admin/auth/staff/account-id',
    '/admin/auth/shared-password',
    '/admin/auth/logout',
  ])('clears private access on protected auth endpoint %s', async (path) => {
    const listener = vi.fn();
    window.addEventListener(ADMIN_ACCESS_EXPIRED, listener);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );
    try {
      await expect(request(path)).rejects.toThrow();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ADMIN_ACCESS_EXPIRED, listener);
    }
  });
  it.each(['/admin/auth/session', '/admin/auth/gate', '/admin/auth/login'])(
    'handles public auth error locally for %s',
    async (path) => {
      const listener = vi.fn();
      window.addEventListener(ADMIN_ACCESS_EXPIRED, listener);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
      );
      try {
        await expect(request(path)).rejects.toThrow();
        expect(listener).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener(ADMIN_ACCESS_EXPIRED, listener);
      }
    },
  );
});

describe('temporary connection failures', () => {
  it('retries a read after a network failure', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('NetworkError'))
      .mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    const result = request('/admin/dashboard');
    await vi.advanceTimersByTimeAsync(750);
    await expect(result).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not repeat a write when its outcome is unknown', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('NetworkError'));
    vi.stubGlobal('fetch', fetch);
    await expect(
      request('/admin/reports/id/take', { method: 'POST' }),
    ).rejects.toThrow('Нет связи с сервером');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('cancels a retry immediately when the page request is aborted', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new TypeError('NetworkError'));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const result = request('/admin/dashboard', { signal: controller.signal });
    const assertion = expect(result).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
