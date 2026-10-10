import { ApiError } from './contracts';
import { ADMIN_ACCESS_EXPIRED, getAdminCsrf } from './client';

const configuredApiUrl = import.meta.env.VITE_SITE_API_URL?.trim();
export const SITE_API_URL = (configuredApiUrl || '/site-api').replace(
  /\/$/,
  '',
);

const configuredMediaUrl = import.meta.env.VITE_SITE_MEDIA_URL?.trim();
export const SITE_MEDIA_URL = (
  configuredMediaUrl ||
  (SITE_API_URL === '/site-api'
    ? SITE_API_URL
    : SITE_API_URL.replace(/\/api$/, ''))
).replace(/\/$/, '');

export const SITE_PUBLIC_URL = (
  import.meta.env.VITE_SITE_PUBLIC_URL?.trim() || 'https://hub-net.org'
).replace(/\/$/, '');

function responseMessage(value: unknown, status: number) {
  if (value && typeof value === 'object') {
    if ('message' in value) return String(value.message);
    if ('error' in value) return String(value.error);
  }
  return `HTTP ${status}`;
}

export async function siteRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const csrf = getAdminCsrf();
  const response = await fetch(`${SITE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(csrf ? { 'X-Admin-CSRF': csrf } : {}),
      ...init.headers,
    },
  });
  const value: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event(ADMIN_ACCESS_EXPIRED));
    }
    throw new ApiError(
      response.status,
      responseMessage(value, response.status),
    );
  }
  return value as T;
}

export function resolveSiteMediaUrl(value: string | null | undefined) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/uploads/')) return `${SITE_MEDIA_URL}${value}`;
  return value;
}

export function editableSiteHtml(value: string) {
  if (!value || typeof document === 'undefined') return value;
  const root = document.createElement('div');
  root.innerHTML = value;
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const source = image.getAttribute('src');
    if (source?.startsWith('/uploads/')) {
      image.setAttribute('src', resolveSiteMediaUrl(source));
      image.dataset.siteUpload = source;
    }
  });
  return root.innerHTML;
}

export function storedSiteHtml(value: string) {
  if (!value || typeof document === 'undefined') return value;
  const root = document.createElement('div');
  root.innerHTML = value;
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const canonical = image.dataset.siteUpload;
    if (canonical?.startsWith('/uploads/')) {
      image.setAttribute('src', canonical);
      delete image.dataset.siteUpload;
      return;
    }
    const source = image.getAttribute('src') || '';
    const proxyPrefix = `${SITE_MEDIA_URL}/uploads/`;
    if (source.startsWith(proxyPrefix)) {
      image.setAttribute('src', `/uploads/${source.slice(proxyPrefix.length)}`);
    }
  });
  return root.innerHTML;
}
