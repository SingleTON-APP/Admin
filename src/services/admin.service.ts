import { request } from '../api/client';
import type { PageRequest } from '../api/contracts';
import type {
  AuditEvent, ContextLevel, Dashboard, PageResult, ReportDetails,
  ReportPriority, ReportsResult, ReportStatus, ReportTargetType,
  ReportContextContent, StaffIdentity, StaffRole, StaffSummary,
  SystemStatus, UserDetails, UserSummary,
} from '../types/domain';

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}
const json = (method: string, body?: unknown, signal?: AbortSignal): RequestInit => ({
  method, signal, body: body === undefined ? undefined : JSON.stringify(body),
});
const requestId = () => crypto.randomUUID();

export interface ReportsQuery extends PageRequest {
  targetType?: ReportTargetType; status?: ReportStatus; priority?: ReportPriority;
  assignee?: string; age?: string; view?: 'new' | 'mine' | 'critical' | 'unassigned';
  sort?: 'priority' | 'age' | 'updated'; order?: 'asc' | 'desc';
}
export type ModerationAction =
  | 'DELETE_MESSAGE' | 'HIDE_POST' | 'DELETE_POST' | 'HIDE_COMMENT'
  | 'DELETE_COMMENT' | 'TEMPORARY_BAN' | 'PERMANENT_BAN';

export const adminService = {
  me: (signal?: AbortSignal) => request<StaffIdentity>('/admin/me', { signal }),
  dashboard: (signal?: AbortSignal) => request<Dashboard>('/admin/dashboard', { signal }),
  users: (input: PageRequest & { status?: string; role?: string; sort?: string; order?: string }) =>
    request<PageResult<UserSummary>>(`/admin/users?${queryString({
      page: input.page, limit: input.pageSize, search: input.search, status: input.status,
      role: input.role, sort: input.sort, order: input.order,
    })}`, { signal: input.signal }),
  user: (id: string, signal?: AbortSignal) => request<UserDetails>(`/admin/users/${id}`, { signal }),
  sanction: (id: string, body: { type: 'TEMPORARY' | 'PERMANENT'; durationDays?: number; reason: string }) =>
    request(`/admin/users/${id}/sanctions`, json('POST', body)),
  unban: (id: string, reason: string) => request(`/admin/users/${id}/sanctions`, json('DELETE', { reason })),
  deleteUser: (id: string, reason: string) => request(`/admin/users/${id}`, json('DELETE', { reason })),
  revokeSession: (userId: string, sessionId: string, reason: string) =>
    request(`/admin/sessions/${sessionId}`, json('DELETE', { userId, reason })),
  revokeAllSessions: (id: string, reason: string) =>
    request(`/admin/users/${id}/sessions`, json('DELETE', { reason })),

  reports: (input: ReportsQuery) => request<ReportsResult>(`/admin/reports?${queryString({
    page: input.page, limit: input.pageSize, search: input.search, targetType: input.targetType,
    status: input.status, priority: input.priority, assignee: input.assignee,
    age: input.age, view: input.view, reportSort: input.sort, order: input.order,
  })}`, { signal: input.signal }),
  report: (id: string, signal?: AbortSignal) =>
    request<ReportDetails>(`/admin/reports/${id}`, { signal }),
  reportContext: (id: string, input: {
    level: ContextLevel; before?: number; after?: number; justification?: string; signal?: AbortSignal;
  }) => request<ReportContextContent>(`/admin/reports/${id}/context`, {
    ...json('POST', {
      level: input.level, before: input.before, after: input.after,
      justification: input.justification,
    }, input.signal),
    headers: { 'X-Request-ID': requestId() },
  }),
  takeReport: (id: string) => request<ReportDetails>(`/admin/reports/${id}/take`, json('POST')),
  assignReport: (id: string, staffUserId: string) =>
    request<ReportDetails>(`/admin/reports/${id}/assign`, json('PATCH', { staffUserId })),
  updateReportStatus: (id: string, status: Extract<ReportStatus, 'RESOLVED' | 'REJECTED'>, reason: string) =>
    request<ReportDetails>(`/admin/reports/${id}/status`, json('PATCH', { status, reason })),
  updateReportPriority: (id: string, priority: ReportPriority) =>
    request<ReportDetails>(`/admin/reports/${id}/priority`, json('PATCH', { priority })),
  addReportNote: (id: string, body: string) =>
    request<ReportDetails>(`/admin/reports/${id}/notes`, json('POST', { body })),
  moderateReportTarget: (id: string, action: ModerationAction, reason: string, durationDays?: number) =>
    request<ReportDetails>(`/admin/reports/${id}/actions`, json('POST', { action, reason, durationDays })),

  staff: (signal?: AbortSignal) => request<StaffSummary[]>('/admin/staff', { signal }),
  changeRole: (id: string, role: StaffRole | 'USER', reason: string) =>
    request<StaffSummary>(`/admin/staff/${id}/role`, json('PATCH', { role, reason })),
  audit: (input: PageRequest) => request<PageResult<AuditEvent>>(
    `/admin/audit?${queryString({ page: input.page, limit: input.pageSize })}`,
    { signal: input.signal },
  ),
  system: (signal?: AbortSignal) => request<SystemStatus>('/admin/system', { signal }),
};
