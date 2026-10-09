import { ApiError } from './contracts';

const API_URL = (import.meta.env.VITE_API_URL?.trim() || '/api').replace(
  /\/$/,
  '',
);

let adminCsrf = '';
export function setAdminCsrf(token: string) {
  adminCsrf = token;
}
export function getAdminCsrf() {
  return adminCsrf;
}
export const ADMIN_ACCESS_EXPIRED = 'admin-access-expired';

function delay(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function resilientFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const read = ['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase());
  const attempts = read ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await delay(attempt * 750, init.signal);
    const controller = new AbortController();
    const abort = () => controller.abort(init.signal?.reason);
    if (init.signal?.aborted) abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (
        read &&
        [502, 503, 504].includes(response.status) &&
        attempt < attempts - 1
      )
        continue;
      return response;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt === attempts - 1)
        throw new Error(
          'Нет связи с сервером. Проверьте подключение и повторите загрузку.',
          { cause: error },
        );
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', abort);
    }
  }
  throw new Error('Не удалось получить ответ сервера');
}

/** Файл с API (cookie-сессия), например скриншот из обращения в поддержку. */
export async function requestBlob(
  path: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok)
    throw new ApiError(response.status, `HTTP ${response.status}`);
  return response.blob();
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await resilientFetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(adminCsrf &&
      init.method &&
      !['GET', 'HEAD'].includes(init.method.toUpperCase())
        ? { 'X-Admin-CSRF': adminCsrf }
        : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const value: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) {
    const publicAuthEndpoint = [
      '/admin/auth/session',
      '/admin/auth/gate',
      '/admin/auth/login',
    ].includes(path.split('?')[0] ?? path);
    if (response.status === 401 && !publicAuthEndpoint) {
      adminCsrf = '';
      window.dispatchEvent(new Event(ADMIN_ACCESS_EXPIRED));
    }
    const message =
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : `HTTP ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return value as T;
}
