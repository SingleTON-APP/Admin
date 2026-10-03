import { request, setAdminCsrf } from '../api/client';
import type { StaffIdentity, StaffRole } from '../types/domain';
export interface AdminSession {
  gateAuthenticated: boolean;
  actor: StaffIdentity | null;
  csrfToken: string;
}
export interface AdminAccount {
  id: string;
  username: string;
  userId: string;
  role: StaffRole;
  disabled: boolean;
}
async function sessionRequest(path: string, init?: RequestInit) {
  const session = await request<AdminSession>(`/admin/auth/${path}`, init);
  setAdminCsrf(session.csrfToken);
  return session;
}
export const adminAuthService = {
  session: () => sessionRequest('session'),
  gate: async (password: string) => {
    await request('/admin/auth/gate', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    return sessionRequest('session');
  },
  login: async (username: string, password: string) => {
    await request('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return sessionRequest('session');
  },
  logout: () => request<void>('/admin/auth/logout', { method: 'POST' }),
  staff: (signal?: AbortSignal) =>
    request<AdminAccount[]>('/admin/auth/staff', { signal }),
  create: (data: {
    username: string;
    password: string;
    userId?: string;
    name?: string;
    email?: string;
    role: StaffRole;
  }) =>
    request('/admin/auth/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: { role?: StaffRole; disabled?: boolean; password?: string },
  ) =>
    request(`/admin/auth/staff/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  sharedPassword: (password: string) =>
    request<void>('/admin/auth/shared-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
