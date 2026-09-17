import { ApiError } from './contracts';

const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:11001/api'
).replace(/\/$/, '');

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const value: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : `HTTP ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return value as T;
}
