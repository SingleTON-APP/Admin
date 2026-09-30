import { request } from '../api/client';
import type { PageRequest } from '../api/contracts';
import type {
  AuditEvent,
  ContextLevel,
  Dashboard,
  PageResult,
  ReportContextContent,
  ReportDetails,
  ReportPriority,
  ReportsResult,
  ReportStatus,
  ReportTargetType,
  StaffIdentity,
  StaffRole,
  StaffSummary,
  SystemStatus,
  UserDetails,
  UserSummary,
} from '../types/domain';

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
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
const requestId = () => crypto.randomUUID();
type RawAudit = Partial<AuditEvent> & {
  actor?: StaffSummary | null;
  createdAt?: string;
};
const auditEvent = (value: RawAudit): AuditEvent => ({
  id: value.id ?? '',
  timestamp: value.timestamp ?? value.createdAt ?? '',
  staff: value.staff ?? value.actor ?? null,
  action: value.action ?? '',
  targetType: value.targetType ?? '',
  targetId: value.targetId ?? null,
  reason: value.reason ?? null,
  result: value.result ?? 'UNKNOWN',
  metadata: value.metadata ?? {},
});
type RawNote = {
  id: string;
  body: string;
  actor?: StaffSummary | null;
  author?: StaffSummary | null;
  createdAt: string;
};
type RawReportDetails = Omit<ReportDetails, 'history' | 'notes'> & {
  history?: RawAudit[];
  notes?: RawNote[];
};
type RawDashboard = Omit<Dashboard, 'recentActions' | 'registrationTrend'> & {
  recentActions: RawAudit[];
  registrationTrend: Array<{
    date: string;
    count?: number;
    registrations?: number;
    activeUsers?: number;
  }>;
};
const reportDetails = (value: RawReportDetails): ReportDetails => ({
  ...value,
  history: (value.history ?? []).map(auditEvent),
  notes: (value.notes ?? []).map((note) => ({
    ...note,
    author: note.author ?? note.actor ?? null,
  })),
  targetRisk: value.targetRisk ?? { priorReports: 0, sanctions: [] },
});

export interface ReportsQuery extends PageRequest {
  targetType?: ReportTargetType;
  status?: ReportStatus;
  priority?: ReportPriority;
  assigneeId?: string;
  olderThanHours?: number;
  view?: 'new' | 'mine' | 'critical' | 'unassigned';
  sort?: 'priority' | 'age' | 'updatedAt';
  order?: 'asc' | 'desc';
}
export type ModerationAction =
  | 'DELETE_MESSAGE'
  | 'HIDE_POST'
  | 'DELETE_POST'
  | 'HIDE_COMMENT'
  | 'DELETE_COMMENT'
  | 'TEMP_BAN_USER'
  | 'PERMANENT_BAN_USER';

export const adminService = {
  me: (signal?: AbortSignal) => request<StaffIdentity>('/admin/me', { signal }),
  dashboard: (signal?: AbortSignal) =>
    request<RawDashboard>('/admin/dashboard', { signal }).then((value) => ({
      ...value,
      recentActions: value.recentActions.map(auditEvent),
      registrationTrend: value.registrationTrend.map((point) => ({
        date: point.date,
        count: Number(point.count ?? point.registrations ?? 0),
        secondary: Number(point.activeUsers ?? 0),
      })),
    })),
  users: (
    input: PageRequest & {
      status?: string;
      role?: string;
      sort?: string;
      order?: string;
    },
  ) =>
    request<PageResult<UserSummary>>(
      `/admin/users?${queryString({
        page: input.page,
        limit: input.pageSize,
        search: input.search,
        status: input.status,
        role: input.role,
        sort: input.sort,
        order: input.order?.toUpperCase(),
      })}`,
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

  reports: (input: ReportsQuery) =>
    request<
      Omit<ReportsResult, 'counts'> & {
        counts: Omit<ReportsResult['counts'], 'all'>;
      }
    >(
      `/admin/reports?${queryString({
        page: input.page,
        limit: input.pageSize,
        search: input.search,
        targetType: input.targetType,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        olderThanHours: input.olderThanHours,
        view: input.view?.toUpperCase(),
        reportSort: input.sort,
        reportOrder: input.order?.toUpperCase(),
      })}`,
      { signal: input.signal },
    ).then((value) => ({
      ...value,
      counts: { all: value.total, ...value.counts },
    })),
  report: (id: string, signal?: AbortSignal) =>
    request<ReportDetails>(`/admin/reports/${id}`, { signal }).then(
      reportDetails,
    ),
  reportContext: (
    id: string,
    input: {
      level: ContextLevel;
      before?: number;
      after?: number;
      justification?: string;
      signal?: AbortSignal;
    },
  ) =>
    request<ReportContextContent>(`/admin/reports/${id}/context`, {
      ...json(
        'POST',
        {
          level: input.level,
          before: input.before,
          after: input.after,
          justification: input.justification,
        },
        input.signal,
      ),
      headers: { 'X-Request-ID': requestId() },
    }),
  takeReport: (id: string) =>
    request<ReportDetails>(`/admin/reports/${id}/take`, json('POST')).then(
      reportDetails,
    ),
  assignReport: (id: string, staffUserId: string) =>
    request<ReportDetails>(
      `/admin/reports/${id}/assign`,
      json('PATCH', { staffUserId }),
    ).then(reportDetails),
  updateReportStatus: (
    id: string,
    status: Extract<ReportStatus, 'RESOLVED' | 'REJECTED'>,
    reason: string,
  ) =>
    request<ReportDetails>(
      `/admin/reports/${id}/status`,
      json('PATCH', { status, reason }),
    ).then(reportDetails),
  updateReportPriority: (id: string, priority: ReportPriority) =>
    request<ReportDetails>(
      `/admin/reports/${id}/priority`,
      json('PATCH', { priority }),
    ).then(reportDetails),
  addReportNote: (id: string, body: string) =>
    request<RawNote>(`/admin/reports/${id}/notes`, json('POST', { body })),
  moderateReportTarget: (
    id: string,
    action: ModerationAction,
    reason: string,
    durationDays?: number,
  ) => {
    const idempotencyKey = requestId();
    return request(`/admin/reports/${id}/actions`, {
      ...json('POST', { action, reason, durationDays, idempotencyKey }),
      headers: {
        'X-Request-ID': idempotencyKey,
        'Idempotency-Key': idempotencyKey,
      },
    });
  },

  staff: (signal?: AbortSignal) =>
    request<StaffSummary[]>('/admin/staff', { signal }),
  changeRole: (id: string, role: StaffRole | 'USER', reason: string) =>
    request<StaffSummary>(
      `/admin/staff/${id}/role`,
      json('PATCH', { role, reason }),
    ),
  audit: (input: PageRequest) =>
    request<PageResult<RawAudit>>(
      `/admin/audit?${queryString({ page: input.page, limit: input.pageSize })}`,
      { signal: input.signal },
    ).then((value) => ({ ...value, items: value.items.map(auditEvent) })),
  system: (signal?: AbortSignal) =>
    request<SystemStatus>('/admin/system', { signal }),
};
