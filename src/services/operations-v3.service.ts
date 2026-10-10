import { request } from '../api/client';
import type { Report, PageResult } from '../types/domain';
import type { Threshold } from './operations-v2.service';

export interface OperationsIncident {
  id: string;
  notificationId: string | null;
  title: string;
  severity: string;
  source: 'SERVICE' | 'MANUAL';
  status: 'OPEN' | 'INVESTIGATING' | 'MONITORING' | 'RESOLVED';
  ownerId: string | null;
  ownerName: string | null;
  affectedFunctions: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  signalResolved: boolean;
  occurrences: number;
}
export interface IncidentDetails extends OperationsIncident {
  timeline: Array<{
    id: string;
    actorName: string | null;
    body: string;
    action: string;
    createdAt: string;
  }>;
}
export interface BackupRun {
  id: string;
  kind: 'BACKUP' | 'RESTORE_TEST';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  bytes: number | null;
  digest: string | null;
  errorCode: string | null;
}
export interface BackupStatus {
  configured: boolean;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  maxBackupAgeHours: number;
  maxRestoreAgeDays: number;
  lastSuccess: BackupRun | null;
  lastRestoreTest: BackupRun | null;
  items: BackupRun[];
  generatedAt: string;
}
export interface Release {
  id: string;
  service: 'BACKEND' | 'WEB' | 'ADMIN' | 'AUTH';
  revision: string | null;
  imageId: string;
  startedAt: string;
  observedAt: string;
}
export interface ReleaseComparison {
  from: string;
  to: string;
  complete: boolean;
  operations: Array<{
    operationId: string;
    count: number;
    errors: number;
    errorRate: number | null;
    p95Ms: number | null;
    meanMs: number | null;
  }>;
  calls: Array<{
    mode: string;
    connects: number;
    failures: number;
    disconnects: number;
    samples: number;
    packetLossPercent: number | null;
    rttMs: number | null;
    jitterMs: number | null;
  }>;
}
export interface Releases {
  items: Release[];
  selectedReleaseId: string | null;
  windowMinutes: 15 | 60;
  before: ReleaseComparison | null;
  after: ReleaseComparison | null;
  limitations: string[];
}
export interface SettingChange {
  id: string;
  version: number;
  actorName: string;
  reason: string;
  before: Threshold[];
  after: Threshold[];
  createdAt: string;
  revertedFrom: string | null;
  canRollback: boolean;
}
export interface SecuritySettingChange {
  id: string;
  action: string;
  actorName: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export type SensitiveAction =
  'PERMANENT_BAN_USER' | 'DELETE_USER' | 'REVOKE_ALL_SESSIONS';
export interface ActionProposal {
  id: string;
  action: SensitiveAction;
  target: { id: string; name: string; publicId: string };
  reportId: string | null;
  reason: string;
  status:
    | 'PENDING'
    | 'APPROVED'
    | 'EXECUTING'
    | 'EXECUTED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'STALE'
    | 'NEEDS_RECONCILIATION';
  revision: number;
  expiresAt: string;
  creator: { id: string; name: string };
  approver: { id: string; name: string } | null;
  createdAt: string;
  canApprove: boolean;
  canExecute: boolean;
}
export interface BulkPreview {
  id: string;
  reportIds: string[];
  count: number;
  affectedUserCount: number;
  action: 'RESOLVE_REPORT' | 'REJECT_REPORT' | 'NO_VIOLATION';
  reason: string;
  expiresAt: string;
  status: 'OPEN';
  createdAt: string;
}
export interface Dossier {
  user: {
    id: string;
    publicId: string;
    name: string;
    role: string;
    createdAt: string;
  };
  counts: Record<
    'reports' | 'sanctions' | 'decisions' | 'appeals' | 'audit',
    number
  >;
  section: 'reports' | 'sanctions' | 'decisions' | 'appeals' | 'audit';
  items: Array<{
    id: string;
    createdAt: string;
    reason: string | null;
    targetType?: string;
    targetId?: string;
    status?: string;
    priority?: string;
    category?: string | null;
    resolutionReason?: string | null;
    updatedAt?: string;
    dueAt?: string | null;
    assigneeId?: string | null;
    relation?: 'SUBMITTED' | 'TARGET';
    type?: string;
    expiresAt?: string | null;
    revokedAt?: string | null;
    action?: string;
    publicReason?: string | null;
    party?: string;
    reportCount?: number;
    decisionId?: string;
    reviewedAt?: string | null;
    reviewReason?: string | null;
    decisionAction?: string;
    result?: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
const write = (body: unknown, method = 'POST') => ({
  method,
  body: JSON.stringify(body),
});

export interface DiagnosticTrace {
  code: string;
  occurredAt: string;
  expiresAt: string;
  status: 'CAPTURED';
  retentionDays: number;
  timeline: Array<
    | {
        stage: 'HTTP_REQUEST';
        service: string;
        method: string;
        routeTemplate: string;
        status: number;
        durationMs: number;
        startedAt: string;
        finishedAt: string;
      }
    | {
        stage: 'PROCESS_STAGE';
        service: string;
        operation: 'message.server' | 'message.persistence' | 'message.fanout';
        durationMs: number | null;
        failed: boolean;
        startedAt: string;
        finishedAt: string;
      }
  >;
  coverage: {
    http: 'SERVER_FAILURE_ONLY';
    processStages: 'OBSERVED' | 'UNAVAILABLE';
    messageDelivery: 'UNAVAILABLE';
    client: 'REFERENCE_ONLY';
  };
  limitations: string[];
}
export const operationsV3Service = {
  incidents: (signal?: AbortSignal) =>
    request<{ items: OperationsIncident[]; generatedAt: string }>(
      '/admin/operations/incidents',
      { signal },
    ),
  incident: (id: string, signal?: AbortSignal) =>
    request<IncidentDetails>(
      `/admin/operations/incidents/${encodeURIComponent(id)}`,
      { signal },
    ),
  createIncident: (body: {
    title: string;
    affectedFunctions: string[];
    note: string;
  }) => request<OperationsIncident>('/admin/operations/incidents', write(body)),
  updateIncident: (
    id: string,
    body: {
      expectedVersion: number;
      status?: OperationsIncident['status'];
      claim?: boolean;
      note: string;
    },
  ) =>
    request<IncidentDetails>(
      `/admin/operations/incidents/${encodeURIComponent(id)}`,
      write(body, 'PATCH'),
    ),
  backups: (signal?: AbortSignal) =>
    request<BackupStatus>('/admin/operations/backups', { signal }),
  releases: (windowMinutes: 15 | 60, releaseId: string, signal?: AbortSignal) =>
    request<Releases>(
      `/admin/operations/releases?windowMinutes=${windowMinutes}${releaseId ? `&releaseId=${encodeURIComponent(releaseId)}` : ''}`,
      { signal },
    ),
  settings: (signal?: AbortSignal) =>
    request<{
      version: number;
      items: SettingChange[];
      securityChanges?: SecuritySettingChange[];
    }>('/admin/operations/settings', { signal }),
  rollback: (id: string, expectedVersion: number, reason: string) =>
    request(
      `/admin/operations/settings/${encodeURIComponent(id)}/rollback`,
      write({ expectedVersion, reason }),
    ),
  dossier: (
    id: string,
    section: Dossier['section'],
    page: number,
    signal?: AbortSignal,
  ) =>
    request<Dossier>(
      `/admin/users/${encodeURIComponent(id)}/dossier?section=${section}&page=${page}&limit=25`,
      { signal },
    ),
  deadline: (
    id: string,
    dueAt: string | null,
    expectedUpdatedAt: string,
    reason: string,
  ) =>
    request<Report>(
      `/admin/reports/${encodeURIComponent(id)}/deadline`,
      write({ dueAt, expectedUpdatedAt, reason }, 'PATCH'),
    ),
  previewBulk: (body: {
    reportIds: string[];
    action: BulkPreview['action'];
    reason: string;
    publicReason?: string;
  }) => request<BulkPreview>('/admin/report-bulk/previews', write(body)),
  executeBulk: (id: string, idempotencyKey: string) =>
    request(
      `/admin/report-bulk/previews/${encodeURIComponent(id)}/execute`,
      write({ idempotencyKey }),
    ),
  createProposal: (body: {
    action: SensitiveAction;
    targetUserId: string;
    reportId?: string;
    reason: string;
    idempotencyKey: string;
  }) => request<ActionProposal>('/admin/action-proposals', write(body)),
  proposals: (page: number, status: string, signal?: AbortSignal) =>
    request<PageResult<ActionProposal>>(
      `/admin/action-proposals?page=${page}&limit=25${status ? `&status=${encodeURIComponent(status)}` : ''}`,
      { signal },
    ),
  proposal: (id: string, signal?: AbortSignal) =>
    request<ActionProposal>(
      `/admin/action-proposals/${encodeURIComponent(id)}`,
      { signal },
    ),
  reviewProposal: (
    id: string,
    decision: 'APPROVE' | 'REJECT',
    expectedRevision: number,
    reason: string,
  ) =>
    request<ActionProposal>(
      `/admin/action-proposals/${encodeURIComponent(id)}/review`,
      write({ decision, expectedRevision, reason }),
    ),
  executeProposal: (id: string, expectedRevision: number) =>
    request<ActionProposal>(
      `/admin/action-proposals/${encodeURIComponent(id)}/execute`,
      write({ expectedRevision }),
    ),
  diagnostic: (code: string, signal?: AbortSignal) =>
    request<DiagnosticTrace>(`/admin/diagnostics/${encodeURIComponent(code)}`, {
      signal,
    }),
};
