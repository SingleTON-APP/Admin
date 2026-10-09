import { request } from '../api/client';
import type { ProcessOperation } from './process-metrics.service';
import type {
  Report,
  ReportPriority,
  ReportTargetType,
  StaffRole,
} from '../types/domain';

export interface Coverage {
  from: string;
  to: string;
  availableFrom: string | null;
  partial: boolean;
  storage: 'DATABASE';
  bucket: 'HOUR' | 'MINUTE';
  retentionDays: number;
  flushIntervalSeconds: number;
}
export interface MetricHistory {
  generatedAt?: string;
  coverage: Coverage;
  operations: ProcessOperation[];
}
export interface MetricIncident {
  id: string;
  kind: 'SERVICE';
  severity: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  metadata: { serviceId?: string; operationId?: string };
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  occurrences: number;
  revision: number;
  durationSeconds: number;
}
export interface ServiceHistory {
  coverage: Coverage;
  services: Array<{
    id: string;
    name: string;
    series: Array<{
      timestamp: string;
      latencyMs: number | null;
      status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
      checks: number;
      downChecks: number;
    }>;
  }>;
}
export interface Threshold {
  operationId: string;
  enabled: boolean;
  p95Ms: number;
  errorRate: number;
  minSamples: number;
}
export interface CallAggregate {
  connects: number;
  failures: number;
  disconnects: number;
  recoveries: number;
  samples: number;
  packetsReceived: number;
  packetsLost: number;
  packetLossPercent: number | null;
  rttMs: number | null;
  jitterMs: number | null;
  relaySamples: number;
  directSamples: number;
  unknownRelaySamples: number;
  connectionP95Ms: number | null;
}
export interface CallQuality {
  generatedAt: string;
  coverage: Coverage;
  modes: Array<
    CallAggregate & {
      mode: 'P2P' | 'GROUP';
      series: Array<CallAggregate & { timestamp: string }>;
    }
  >;
}
export interface ReportGroup {
  groupKey: string;
  targetType: ReportTargetType;
  targetId: string;
  sourceContextId: string | null;
  count: number;
  openCount: number;
  highestPriority: ReportPriority;
  oldestAt: string;
  latestAt: string;
  sampleReportId: string;
}
export interface GroupDecision {
  id: string;
  action: 'RESOLVE_REPORT' | 'REJECT_REPORT' | 'NO_VIOLATION';
  reason: string;
  actor: { id: string; name: string };
  createdAt: string;
  reportCount: number;
}
export interface GroupDetails {
  group: ReportGroup;
  reports: Report[];
  decisions: GroupDecision[];
  hasMore?: boolean;
}
export interface Appeal {
  id: string;
  decisionId: string;
  source?: 'SANCTION' | 'REPORT';
  appellant: { id: string; name: string };
  party: 'REPORTER' | 'SUBJECT';
  reason: string;
  status: 'OPEN' | 'UPHELD' | 'REVIEW_REQUIRED';
  createdAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  reviewer: { id: string; name: string } | null;
  decision: Omit<GroupDecision, 'actor'> & {
    actor: { id: string | null; name: string };
    targetType: ReportTargetType;
    targetId: string;
  };
  canReview: boolean;
  history?: Array<{
    action: string;
    reason: string;
    actor: { id: string; name: string };
    createdAt: string;
  }>;
}
export interface StaffSession {
  id: string;
  current: boolean;
  username: string;
  role: StaffRole;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}
export interface StaffSecurity {
  totpEnabled: boolean;
  totpConfigured: boolean;
}
export interface ResultPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
const write = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
const params = (values: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();
export const operationsService = {
  incidents: (days: 7 | 30, signal?: AbortSignal) =>
    request<{ items: MetricIncident[]; limit: number; generatedAt: string }>(
      `/admin/process-metrics/incidents?days=${days}`,
      { signal },
    ),
  history: (days: 7 | 30, signal?: AbortSignal) =>
    request<MetricHistory>(`/admin/process-metrics/history?days=${days}`, {
      signal,
    }),
  serviceHistory: (days: 7 | 30, signal?: AbortSignal) =>
    request<ServiceHistory>(
      `/admin/process-metrics/history/services?days=${days}`,
      { signal },
    ),
  quality: (
    range: { days: 7 | 30 } | { windowMinutes: 15 | 60 },
    signal?: AbortSignal,
  ) =>
    request<CallQuality>(
      `/admin/process-metrics/call-quality?${params(range)}`,
      { signal },
    ),
  thresholds: (signal?: AbortSignal) =>
    request<{ items: Threshold[] }>('/admin/process-metrics/thresholds', {
      signal,
    }),
  saveThresholds: (items: Threshold[], reason: string) =>
    request<{ items: Threshold[] }>(
      '/admin/process-metrics/thresholds',
      write({ items, reason }, 'PATCH'),
    ),
  groups: (
    query: {
      page: number;
      status?: string;
      targetType?: string;
      search?: string;
    },
    signal?: AbortSignal,
  ) =>
    request<ResultPage<ReportGroup>>(
      `/admin/report-groups?${params({ ...query, limit: 25 })}`,
      { signal },
    ),
  group: (id: string, signal?: AbortSignal) =>
    request<GroupDetails>(`/admin/report-groups/${encodeURIComponent(id)}`, {
      signal,
    }),
  decide: (
    id: string,
    data: {
      reportIds: string[];
      action: GroupDecision['action'];
      reason: string;
      publicReason?: string;
      idempotencyKey: string;
    },
  ) =>
    request<{
      success: boolean;
      decisionId: string;
      reportIds: string[];
      repeated: boolean;
    }>(`/admin/report-groups/${encodeURIComponent(id)}/decision`, write(data)),
  appeals: (page: number, status?: string, signal?: AbortSignal) =>
    request<ResultPage<Appeal>>(
      `/admin/appeals?${params({ page, limit: 25, status })}`,
      { signal },
    ),
  appeal: (id: string, signal?: AbortSignal) =>
    request<Appeal>(`/admin/appeals/${encodeURIComponent(id)}`, { signal }),
  review: (id: string, outcome: 'UPHELD' | 'REVIEW_REQUIRED', reason: string) =>
    request<Appeal>(
      `/admin/appeals/${encodeURIComponent(id)}/review`,
      write({ outcome, reason }),
    ),
  sessions: (signal?: AbortSignal) =>
    request<StaffSecurity & { items: StaffSession[] }>('/admin/auth/sessions', {
      signal,
    }),
  revokeSession: (id: string, reason: string) =>
    request(
      `/admin/auth/sessions/${encodeURIComponent(id)}/revoke`,
      write({ reason }),
    ),
  security: (signal?: AbortSignal) =>
    request<StaffSecurity>('/admin/auth/security', { signal }),
  setupTotp: (password: string) =>
    request<{ secret: string; otpauthUrl: string }>(
      '/admin/auth/totp/setup',
      write({ password }),
    ),
  confirmTotp: (code: string) =>
    request<{ success: boolean; recoveryCodes: string[] }>(
      '/admin/auth/totp/confirm',
      write({ code }),
    ),
  disableTotp: (password: string, code: string) =>
    request('/admin/auth/totp/disable', write({ password, code })),
};
