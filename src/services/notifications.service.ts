import { request } from '../api/client';

export interface AdminNotification {
  id: string;
  revision: number;
  kind: 'SERVICE' | 'SECURITY';
  severity: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  occurrences: number;
  read: boolean;
  metadata: {
    serviceId?: string;
    status?: string;
    stage?: 'GATE' | 'SESSION';
    username?: string;
    ip?: string;
    attempts?: number;
    blockedUntil?: string;
  };
}
export interface NotificationPage {
  items: AdminNotification[];
  unreadCount: number;
  generatedAt: string;
  nextCursor: string | null;
}
export const notificationsService = {
  list: (signal?: AbortSignal, cursor?: string) =>
    request<NotificationPage>(
      `/admin/notifications?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      { signal },
    ),
  read: (item: Pick<AdminNotification, 'id' | 'revision'>) =>
    request(`/admin/notifications/${encodeURIComponent(item.id)}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ revision: item.revision }),
    }),
  readShown: (items: AdminNotification[]) =>
    request('/admin/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(({ id, revision }) => ({ id, revision })),
      }),
    }),
  resolve: (id: string, reason: string) =>
    request(`/admin/notifications/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
