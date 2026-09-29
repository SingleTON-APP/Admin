export type StaffRole = 'MODERATOR' | 'ADMIN' | 'FULL_ADMIN';
export type UserRole = 'USER' | StaffRole;
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type ReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReportTargetType = 'USER' | 'MESSAGE' | 'CHAT' | 'POST' | 'COMMENT' | 'MEDIA';
export type ContextLevel = 'REPORTED_ONLY' | 'NEARBY' | 'EXTENDED';

export interface StaffIdentity {
  id: string;
  publicId: string;
  name: string;
  email: string;
  role: StaffRole;
}
export interface UserSummary {
  id: string; publicId: string; firstName: string; lastName: string;
  username: string; email: string; avatar: string | null; role: UserRole;
  isActivated: boolean; createdAt: string; lastSeen: string | null;
  status: UserStatus; sanctionExpiresAt: string | null; reportCount: number;
}
export interface StaffSummary extends StaffIdentity {
  status: 'ACTIVE' | 'DISABLED'; assignedAt: string; lastSeen?: string | null;
  lastAction?: AuditEvent | null;
}
export interface Sanction {
  id: string; type: 'TEMPORARY' | 'PERMANENT'; reason: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'; createdAt: string;
  expiresAt: string | null; revokedAt: string | null; actor: StaffSummary | null;
}
export interface SessionInfo {
  id: string; current: boolean; createdAt: number; lastSeen: number; ip: string;
  location: string; device: { browser: string; os: string; type: string };
  linkedApps?: string[];
}
export interface AuditEvent {
  id: string; timestamp: string; staff: StaffSummary | null; action: string;
  targetType: string; targetId: string | null; reason: string | null;
  result: string; metadata: Record<string, unknown>;
}
export interface UserDetails extends Omit<UserSummary, 'reportCount'> {
  reportCount: number; sanctions: Sanction[]; moderationHistory: AuditEvent[];
  sessions: SessionInfo[];
}
export interface MessageMetadata {
  id: string; senderId?: string; chatId?: string; createdAt?: string;
  messageType?: string; status: string; hasAttachments?: boolean;
  reportCount?: number; deleted?: boolean;
}
export interface Report {
  id: string; targetType: ReportTargetType; targetId: string;
  messageId: string | null; chatId: string | null; reason: string;
  category: string; priority: ReportPriority; sourceContextId: string | null;
  status: ReportStatus; resolutionReason: string | null; resolvedAt: string | null;
  createdAt: string; updatedAt: string; reporter: UserSummary | null;
  targetUser: UserSummary | null; assignee: StaffSummary | null;
  relatedReportsCount?: number;
}
export interface ReportNote {
  id: string; body: string; author: StaffSummary | null; createdAt: string;
}
export interface ReportDetails extends Report {
  message?: MessageMetadata | null; history: AuditEvent[]; notes: ReportNote[];
  targetMetadata?: Record<string, unknown> | null;
}
export interface PageResult<T> {
  items: T[]; total: number; page: number; limit: number;
}
export interface ReportQueueCounts {
  all: number; new: number; mine: number; critical: number; unassigned: number;
}
export interface ReportsResult extends PageResult<Report> { counts: ReportQueueCounts; }

export interface ModerationAttachment {
  id?: string; kind: string; mimeType?: string; size?: number;
  previewAvailable?: boolean; mediaRef?: string;
}
export interface ModerationMessage {
  id: string; chatId: string; authorId: string | null; authorName?: string;
  createdAt: string; messageSequence?: number | null; replyToId?: string | null;
  type?: string; text: string | null; deleted: boolean;
  attachments: ModerationAttachment[];
}
export interface MessageContext {
  kind: 'MESSAGE'; appliedLevel: ContextLevel; target: ModerationMessage;
  before: ModerationMessage[]; after: ModerationMessage[];
  hasMoreBefore?: boolean; hasMoreAfter?: boolean;
}
export interface ModerationPost {
  id: string; authorId: string | null; authorName?: string; createdAt: string;
  title?: string | null; body: string | null; deleted: boolean;
  media: ModerationAttachment[];
}
export interface PostContext {
  kind: 'POST'; applied_level: ContextLevel; target: ModerationPost;
  nearby_posts?: ModerationPost[];
}
export interface ModerationComment {
  id: string; postId: string; parentId: string | null; authorId: string | null;
  authorName?: string; createdAt: string; body: string | null; deleted: boolean;
}
export interface CommentContext {
  kind: 'COMMENT'; applied_level: ContextLevel; post: ModerationPost;
  parent_chain: ModerationComment[]; target: ModerationComment;
  siblings: ModerationComment[]; children: ModerationComment[];
  has_more_children?: boolean;
}
export type ReportContextContent = MessageContext | PostContext | CommentContext;

export interface DashboardMetric {
  value: number | null; change?: number | null;
}
export interface DashboardTrendPoint { date: string; count: number; secondary?: number; }
export interface DashboardStatusItem {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'; latencyMs?: number;
}
export interface Dashboard {
  generatedAt: string;
  metrics: {
    totalUsers: number; activeUsers24h: number; newUsers24h: number;
    messages24h: number; posts24h: number | null; openReports: number;
    inReviewReports: number; avgResolutionMinutes: number | null;
    highPriorityReports: number;
  };
  queueAge: { lt1h: number; h1to6: number; h6to24: number; gt24h: number };
  reportsByType: Array<{ type: ReportTargetType; count: number }>;
  reportTrend: DashboardTrendPoint[]; registrationTrend: DashboardTrendPoint[];
  recentActions: AuditEvent[];
  systemStatus: { api: DashboardStatusItem; database: DashboardStatusItem; posts: DashboardStatusItem };
}
export interface SystemStatus {
  api: { status: string; uptimeSeconds: number; version: string };
  database: { status: string; latencyMs: number };
}
