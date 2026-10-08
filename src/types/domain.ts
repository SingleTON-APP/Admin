export type StaffRole = 'MODERATOR' | 'ADMIN' | 'FULL_ADMIN';
export type UserRole = 'USER' | StaffRole;
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type ReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReportTargetType =
  'USER' | 'MESSAGE' | 'CHAT' | 'POST' | 'COMMENT' | 'MEDIA' | 'SUPPORT';
export type ContextLevel = 'REPORTED_ONLY' | 'NEARBY' | 'EXTENDED';

export interface StaffIdentity {
  id: string;
  publicId: string;
  name: string;
  email: string;
  role: StaffRole;
}
export interface StaffSummary extends StaffIdentity {
  status?: 'ACTIVE' | 'DISABLED';
  assignedAt?: string;
  lastSeen?: string | null;
  lastAction?: AuditEvent | null;
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
export interface ReportUserSummary {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar: string | null;
  role: UserRole;
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
export interface UserDetails extends Omit<UserSummary, 'reportCount'> {
  reportCount: number;
  sanctions: Sanction[];
  moderationHistory: AuditEvent[];
  sessions: SessionInfo[];
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
export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  messageId: string | null;
  chatId: string | null;
  reason: string;
  category: string | null;
  priority: ReportPriority;
  sourceContextId: string | null;
  status: ReportStatus;
  resolutionReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: ReportUserSummary | null;
  targetUser: ReportUserSummary | null;
  assignee: StaffSummary | null;
  relatedReportsCount?: number;
}
export interface ReportNote {
  id: string;
  body: string;
  author: StaffSummary | null;
  createdAt: string;
}
export interface ReportRisk {
  priorReports: number;
  sanctions: Array<{
    id: string;
    type: string;
    status: string;
    reason: string;
    createdAt: string;
    expiresAt: string | null;
  }>;
}
export interface ReportDetails extends Report {
  history: AuditEvent[];
  notes: ReportNote[];
  targetRisk: ReportRisk;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface ReportQueueCounts {
  all: number;
  new: number;
  mine: number;
  critical: number;
  unassigned: number;
}
export interface ReportsResult extends PageResult<Report> {
  counts: ReportQueueCounts;
}

export interface ModerationAuthor {
  id?: string;
  userId?: string;
  publicId: string;
  username: string;
  displayName: string;
}
export interface ModerationAttachment {
  kind?: string;
  messageType?: string;
  mediaRef: string;
  previewAvailable: boolean;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  /** Только у обращений в поддержку: файл, приложенный пользователем (API-путь). */
  previewPath?: string | null;
}
export interface ModerationMessage {
  id: string;
  text?: string | null;
  contentUnavailableReason?: string | null;
  author?: ModerationAuthor | null;
  createdAt?: string;
  messageSequence?: number | null;
  messageType?: string;
  status?: string;
  reply?: {
    messageId: string;
    authorId?: string | null;
    messageType?: string | null;
  } | null;
  attachment?: ModerationAttachment | null;
  deleted?: boolean;
}
export interface MessageContext {
  kind: 'MESSAGE';
  appliedLevel: ContextLevel;
  chatId?: string;
  target: ModerationMessage;
  before: ModerationMessage[];
  after: ModerationMessage[];
  hasMoreBefore?: boolean;
  hasMoreAfter?: boolean;
}
export interface ModerationPost {
  id: string;
  topicId?: string;
  topicHashtag?: string;
  title?: string | null;
  body: string | null;
  author: ModerationAuthor | null;
  createdAt: string;
  deleted: boolean;
  media?: ModerationAttachment | null;
}
export interface PostContext {
  kind: 'POST';
  appliedLevel: ContextLevel;
  target: ModerationPost;
  nearbyPosts?: ModerationPost[];
}
export interface ModerationComment {
  id: string;
  postId: string;
  parentCommentId?: string | null;
  body: string | null;
  author: ModerationAuthor | null;
  createdAt: string;
  editedAt?: string | null;
  deleted: boolean;
  depth?: number;
  directReplyCount?: number;
  media?: ModerationAttachment | null;
}
export interface CommentContext {
  kind: 'COMMENT';
  appliedLevel: ContextLevel;
  post: ModerationPost;
  parents: ModerationComment[];
  target: ModerationComment;
  siblings: ModerationComment[];
  children: ModerationComment[];
}
export interface GenericContext {
  kind: 'USER' | 'CHAT' | 'MEDIA';
  appliedLevel?: ContextLevel;
  target: { id?: string; deleted?: boolean; status?: string };
}
export type ReportContextContent =
  MessageContext | PostContext | CommentContext | GenericContext;

export interface DashboardTrendPoint {
  date: string;
  count: number;
  secondary?: number;
}
export interface DashboardStatusItem {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latencyMs?: number;
}
export interface Dashboard {
  generatedAt: string;
  metrics: {
    totalUsers: number;
    activeUsers24h: number;
    newUsers24h: number;
    messages24h: number;
    posts24h: number | null;
    openReports: number;
    inReviewReports: number;
    avgResolutionMinutes: number | null;
    highPriorityReports: number;
  };
  queueAge: { lt1h: number; h1to6: number; h6to24: number; gt24h: number };
  reportsByType: Array<{ type: ReportTargetType; count: number }>;
  reportsByCategory?: Array<{ label: string; value: number }>;
  reportOutcomes?: Array<{ label: string; value: number }>;
  reportResolutionTrend?: Array<{
    date: string;
    resolved: number;
    rejected: number;
  }>;
  reportTrend: DashboardTrendPoint[];
  registrationTrend: DashboardTrendPoint[];
  recentActions: AuditEvent[];
  systemStatus: {
    api: DashboardStatusItem;
    database: DashboardStatusItem;
    posts: DashboardStatusItem;
  };
}
export interface SystemStatus {
  api: { status: string; uptimeSeconds: number; version: string };
  database: { status: string; latencyMs: number };
}
