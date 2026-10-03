import type { ReportPriority, ReportStatus, ReportTargetType } from './domain';
export const reportPriorityLabel: Record<ReportPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критичный',
};
export const reportStatusLabel: Record<ReportStatus, string> = {
  OPEN: 'Новая',
  IN_REVIEW: 'На рассмотрении',
  RESOLVED: 'Решена',
  REJECTED: 'Отклонена',
};
export const reportTargetLabel: Record<ReportTargetType, string> = {
  USER: 'Пользователь',
  MESSAGE: 'Сообщение',
  CHAT: 'Чат',
  POST: 'Пост',
  COMMENT: 'Комментарий',
  MEDIA: 'Медиа',
};
