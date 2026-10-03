export const auditActionLabels: Record<string, string> = {
  ADMIN_GATE_LOGIN: 'Вход по общему паролю',
  ADMIN_STAFF_LOGIN: 'Вход сотрудника',
  ADMIN_ACCESS_BOOTSTRAPPED: 'Создан первоначальный root',
  ADMIN_ACCOUNT_CREATED: 'Создана учётка сотрудника',
  ADMIN_ACCOUNT_UPDATED: 'Изменён доступ сотрудника',
  ADMIN_SHARED_PASSWORD_CHANGED: 'Изменён общий пароль',
  USER_TEMP_BAN: 'Временная блокировка пользователя',
  USER_PERMANENT_BAN: 'Постоянная блокировка пользователя',
  USER_UNBAN: 'Снята блокировка пользователя',
  USER_DELETE: 'Удалён пользователь',
  MESSAGE_DELETE: 'Удалено сообщение',
  ROLE_CHANGE: 'Изменена роль сотрудника',
  STAFF_DISABLE: 'Отключён сотрудник',
  SESSION_REVOKE: 'Завершена сессия',
  SESSION_REVOKE_ALL: 'Завершены все сессии',
  REPORT_RESOLVE: 'Жалоба завершена',
  REPORT_REJECT: 'Жалоба отклонена',
  REPORT_TAKE: 'Жалоба взята в работу',
  REPORT_ASSIGN: 'Назначен исполнитель',
  REPORT_PRIORITY_CHANGE: 'Изменён приоритет',
  REPORT_OPEN: 'Жалоба открыта',
  REPORT_IN_REVIEW: 'Жалоба на рассмотрении',
  REPORT_RESOLVED: 'Жалоба завершена',
  REPORT_REJECTED: 'Жалоба отклонена',
  REPORT_CONTENT_VIEWED: 'Просмотр контекста',
  REPORT_TAKEN: 'Жалоба взята в работу',
  REPORT_ASSIGNED: 'Назначен исполнитель',
  REPORT_PRIORITY_CHANGED: 'Изменён приоритет',
  REPORT_STATUS_CHANGED: 'Изменён статус',
  REPORT_NOTE_ADDED: 'Добавлен комментарий',
  MODERATION_DELETE_MESSAGE: 'Удалено сообщение',
  MODERATION_HIDE_POST: 'Скрыт пост',
  MODERATION_DELETE_POST: 'Удалён пост',
  MODERATION_HIDE_COMMENT: 'Скрыт комментарий',
  MODERATION_DELETE_COMMENT: 'Удалён комментарий',
  MODERATION_TEMP_BAN_USER: 'Временная блокировка',
  MODERATION_PERMANENT_BAN_USER: 'Постоянная блокировка',
  MODERATION_RESOLVE_REPORT: 'Жалоба завершена',
  MODERATION_REJECT_REPORT: 'Жалоба отклонена',
  MODERATION_NO_VIOLATION: 'Нарушение не подтверждено',
};
export const auditResultLabels: Record<string, string> = {
  SUCCESS: 'Успешно',
  FAILED: 'Ошибка',
  DENIED: 'Отказано',
  PENDING: 'Ожидает сверки',
};
export const auditTargetLabels: Record<string, string> = {
  REPORT: 'Жалоба',
  USER: 'Пользователь',
  MESSAGE: 'Сообщение',
  CHAT: 'Чат',
  POST: 'Пост',
  COMMENT: 'Комментарий',
  MEDIA: 'Медиа',
  STAFF: 'Сотрудник',
  SESSION: 'Сессия',
  ADMIN_ACCESS: 'Доступ к админке',
};
export const auditContextLabels: Record<string, string> = {
  REPORTED_ONLY: 'Только объект жалобы',
  NEARBY: 'Ближайший контекст',
  EXTENDED: 'Расширенный контекст',
};
export function auditActionLabel(action: string) {
  return Object.hasOwn(auditActionLabels, action)
    ? auditActionLabels[action]
    : 'Служебное действие';
}
export function auditResultLabel(result: string) {
  return Object.hasOwn(auditResultLabels, result)
    ? auditResultLabels[result]
    : 'Неизвестный результат';
}
export function auditTargetLabel(target: string) {
  return Object.hasOwn(auditTargetLabels, target)
    ? auditTargetLabels[target]
    : target;
}
export function auditContextLabel(level: unknown) {
  return typeof level === 'string' && Object.hasOwn(auditContextLabels, level)
    ? auditContextLabels[level]
    : undefined;
}
export function auditResultClass(result: string) {
  return result === 'SUCCESS'
    ? 'success'
    : ['FAILED', 'DENIED'].includes(result)
      ? 'danger'
      : result === 'PENDING'
        ? 'warning'
        : 'neutral';
}
