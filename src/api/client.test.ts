import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ACCESS_EXPIRED, request, setAdminCsrf } from './client';
afterEach(() => {
  vi.unstubAllGlobals();
  setAdminCsrf('');
});
describe('Admin CSRF client', () => {
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
});
