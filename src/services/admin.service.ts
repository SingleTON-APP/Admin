import { request } from '../api/client';
import type { PageRequest } from '../api/contracts';
import type {
  AuditEvent,
  Dashboard,
  PageResult,
  Report,
  ReportDetails,
  ReportStatus,
  StaffIdentity,
  StaffSummary,
  StaffRole,
  SystemStatus,
  UserDetails,
  UserSummary,
} from '../types/domain';

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(
    ([key, value]) =>
      value !== undefined && value !== '' && params.set(key, String(value)),
  );
  return params.toString();
}

const json = (
  method: string,
  body?: unknown,
  signal?: AbortSignal,
): RequestInit => ({
  method,
  signal,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const adminService = {
  me: (signal?: AbortSignal) => request<StaffIdentity>('/admin/me', { signal }),
  dashboard: (signal?: AbortSignal) =>
    request<Dashboard>('/admin/dashboard', { signal }),
  users: (
    input: PageRequest & {
      status?: string;
      role?: string;
      sort?: string;
      order?: string;
    },
  ) =>
    request<PageResult<UserSummary>>(
      `/admin/users?${queryString({ page: input.page, limit: input.pageSize, search: input.search, status: input.status, role: input.role, sort: input.sort, order: input.order })}`,
      { signal: input.signal },
    ),
  user: (id: string, signal?: AbortSignal) =>
    request<UserDetails>(`/admin/users/${id}`, { signal }),
  sanction: (
    id: string,
    body: {
      type: 'TEMPORARY' | 'PERMANENT';
      durationDays?: number;
      reason: string;
    },
  ) => request(`/admin/users/${id}/sanctions`, json('POST', body)),
  unban: (id: string, reason: string) =>
    request(`/admin/users/${id}/sanctions`, json('DELETE', { reason })),
  deleteUser: (id: string, reason: string) =>
    request(`/admin/users/${id}`, json('DELETE', { reason })),
  revokeSession: (userId: string, sessionId: string, reason: string) =>
    request(`/admin/sessions/${sessionId}`, json('DELETE', { userId, reason })),
  revokeAllSessions: (id: string, reason: string) =>
    request(`/admin/users/${id}/sessions`, json('DELETE', { reason })),
  reports: (input: PageRequest & { status?: string }) =>
    request<PageResult<Report>>(
      `/admin/reports?${queryString({ page: input.page, limit: input.pageSize, status: input.status })}`,
      { signal: input.signal },
    ),
  report: (id: string, signal?: AbortSignal) =>
    request<ReportDetails>(`/admin/reports/${id}`, { signal }),
  takeReport: (id: string) =>
    request<ReportDetails>(`/admin/reports/${id}/take`, json('POST')),
  updateReport: (
    id: string,
    status: Extract<ReportStatus, 'RESOLVED' | 'REJECTED'>,
    reason: string,
  ) =>
    request<ReportDetails>(
      `/admin/reports/${id}/status`,
      json('PATCH', { status, reason }),
    ),
  assignReport: (id: string, staffUserId: string) =>
    request<ReportDetails>(
      `/admin/reports/${id}/assign`,
      json('PATCH', { staffUserId }),
    ),
  deleteMessage: (id: string, reason: string) =>
    request(`/admin/messages/${id}`, json('DELETE', { reason })),
  staff: (signal?: AbortSignal) =>
    request<StaffSummary[]>('/admin/staff', { signal }),
  changeRole: (id: string, role: StaffRole | 'USER', reason: string) =>
    request<StaffSummary>(
      `/admin/staff/${id}/role`,
      json('PATCH', { role, reason }),
    ),
  audit: (input: PageRequest) =>
    request<PageResult<AuditEvent>>(
      `/admin/audit?${queryString({ page: input.page, limit: input.pageSize })}`,
      { signal: input.signal },
    ),
  system: (signal?: AbortSignal) =>
    request<SystemStatus>('/admin/system', { signal }),
};
