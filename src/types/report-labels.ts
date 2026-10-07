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
  SUPPORT: 'Поддержка',
};

/** Категории от клиентов Hub (жалобы, /support, /idea) — по-русски. */
const reportCategoryLabels: Record<string, string> = {
  support: 'Поддержка',
  idea: 'Идея',
  forum: 'Форум',
  spam: 'Спам',
  scam: 'Мошенничество',
  abuse: 'Оскорбления или угрозы',
  other: 'Другое',
};
export const reportCategoryLabel = (category: string | null | undefined) =>
  category ? (reportCategoryLabels[category] ?? category) : '—';
