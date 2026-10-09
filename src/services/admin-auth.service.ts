import { request, setAdminCsrf } from '../api/client';
import type { StaffIdentity, StaffRole } from '../types/domain';
export interface AdminSession {
  gateAuthenticated: boolean;
  actor: StaffIdentity | null;
  csrfToken: string;
  requiresTotp?: boolean;
}
export interface AdminAccount {
  id: string;
  username: string;
  userId: string;
  role: StaffRole;
  disabled: boolean;
  totpEnabled?: boolean;
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
  login: async (username: string, password: string, code?: string) => {
    const result = await request<{ requiresTotp?: boolean }>(
      '/admin/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, ...(code ? { code } : {}) }),
      },
    );
    const session = await sessionRequest('session');
    return result?.requiresTotp ? { ...session, requiresTotp: true } : session;
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
  resetTotp: (id: string, password: string, reason: string) =>
    request(`/admin/auth/staff/${encodeURIComponent(id)}/totp/reset`, {
      method: 'POST',
      body: JSON.stringify({ password, reason }),
    }),
};
