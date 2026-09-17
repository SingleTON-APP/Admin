export type StaffRole = 'MODERATOR' | 'ADMIN' | 'FULL_ADMIN';
export type UserRole = 'USER' | StaffRole;
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface StaffIdentity {
  id: string;
  publicId: string;
  name: string;
  email: string;
  role: StaffRole;
}

export interface UserSummary {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatar: string | null;
  role: UserRole;
  isActivated: boolean;
  createdAt: string;
  lastSeen: string | null;
  status: UserStatus;
  sanctionExpiresAt: string | null;
  reportCount: number;
}

export interface Sanction {
  id: string;
  type: 'TEMPORARY' | 'PERMANENT';
  reason: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  actor: StaffSummary | null;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  createdAt: number;
  lastSeen: number;
  ip: string;
  location: string;
  device: { browser: string; os: string; type: string };
  linkedApps?: string[];
}

export interface UserDetails extends Omit<UserSummary, 'reportCount'> {
  reportCount: number;
  sanctions: Sanction[];
  moderationHistory: AuditEvent[];
  sessions: SessionInfo[];
}

export interface StaffSummary extends StaffIdentity {
  status: 'ACTIVE' | 'DISABLED';
  assignedAt: string;
  lastSeen?: string | null;
  lastAction?: AuditEvent | null;
}

export interface MessageMetadata {
  id: string;
  senderId?: string;
  chatId?: string;
  createdAt?: string;
  messageType?: string;
  status: string;
  hasAttachments?: boolean;
  reportCount?: number;
  deleted?: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  staff: StaffSummary | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  result: string;
  metadata: Record<string, unknown>;
}

export interface Report {
  id: string;
  targetType: 'USER' | 'MESSAGE' | 'CHAT' | 'GROUP' | 'MEDIA';
  messageId: string | null;
  chatId: string | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  reporter: UserSummary | null;
  targetUser: UserSummary;
  assignee: StaffSummary | null;
}

export interface ReportDetails extends Report {
  message: MessageMetadata | null;
  history: AuditEvent[];
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Dashboard {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  bannedUsers: number;
  openReports: number;
  reviewReports: number;
  resolvedReports: number;
  actionCount: number;
  recentActions: AuditEvent[];
}

export interface SystemStatus {
  api: { status: string; uptimeSeconds: number; version: string };
  database: { status: string; latencyMs: number };
}
