import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ACCESS_EXPIRED, setAdminCsrf } from './client';
import {
  editableSiteHtml,
  resolveSiteMediaUrl,
  siteRequest,
  storedSiteHtml,
} from './site-client';

afterEach(() => {
  setAdminCsrf('');
  vi.unstubAllGlobals();
});

describe('website content client', () => {
  it('uses the same Admin origin and its ephemeral CSRF token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    setAdminCsrf('a'.repeat(43));

    await siteRequest('/news/1', { method: 'PUT', body: new FormData() });

    expect(fetch).toHaveBeenCalledWith(
      '/site-api/news/1',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Admin-CSRF': 'a'.repeat(43) }),
      }),
    );
  });

  it('hydrates stored upload paths for editing and stores them canonically again', () => {
    const editable = editableSiteHtml(
      '<p><img src="/uploads/example.png"></p>',
    );
    expect(editable).toContain('src="/site-api/uploads/example.png"');
    expect(editable).toContain('data-site-upload="/uploads/example.png"');
    expect(storedSiteHtml(editable)).toBe(
      '<p><img src="/uploads/example.png"></p>',
    );
    expect(resolveSiteMediaUrl('/uploads/banner.webp')).toBe(
      '/site-api/uploads/banner.webp',
    );
  });

  it('expires Admin access when website session validation returns 401', async () => {
    const listener = vi.fn();
    window.addEventListener(ADMIN_ACCESS_EXPIRED, listener);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    try {
      await expect(siteRequest('/news')).rejects.toThrow('expired');
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ADMIN_ACCESS_EXPIRED, listener);
    }
  });
});
