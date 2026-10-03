import { Link } from 'react-router-dom';
import type { Dashboard } from '../../types/domain';
import { StatCard } from '../ui/Primitives';
import { resolutionDuration } from './dashboard-format';

const number = (value: number | null) =>
  value === null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('ru-RU');
export function DashboardMetrics({
  metrics: m,
}: {
  metrics: Dashboard['metrics'];
}) {
  const cards = [
    {
      label: 'Всего пользователей',
      value: number(m.totalUsers),
      hint: 'Все зарегистрированные пользователи',
    },
    {
      label: 'Активны за 24 часа',
      value: number(m.activeUsers24h),
      hint: 'Пользователи, посещавшие приложение за последние 24 часа. График отдельно считает авторов сообщений.',
    },
    {
      label: 'Новые за 24 часа',
      value: number(m.newUsers24h),
      hint: 'Регистрации за последние 24 часа',
    },
    {
      label: 'Сообщения за 24 часа',
      value: number(m.messages24h),
      hint: 'Созданные сообщения за последние 24 часа',
    },
    {
      label: 'Посты за 24 часа',
      value: number(m.posts24h),
      hint: 'Созданные посты по статистике post-service',
      note: m.posts24h === null ? 'Статистика недоступна' : undefined,
    },
    {
      label: 'Открытые жалобы',
      value: number(m.openReports),
      hint: 'Жалобы со статусом «Новая»',
      tone: 'warning',
      link: '/admin/reports?status=OPEN',
    },
    {
      label: 'На рассмотрении',
      value: number(m.inReviewReports),
      hint: 'Жалобы со статусом «На рассмотрении»',
      link: '/admin/reports?status=IN_REVIEW',
    },
    {
      label: 'Среднее время решения',
      value: resolutionDuration(m.avgResolutionMinutes),
      hint: 'Среднее время от создания до завершения всех жалоб, включая отклонённые',
      note:
        m.avgResolutionMinutes === null ? 'Нет завершённых жалоб' : undefined,
    },
    {
      label: 'Высокий приоритет',
      value: number(m.highPriorityReports),
      hint: 'Новые и рассматриваемые жалобы с высоким или критичным приоритетом',
      tone: 'danger',
    },
  ];
  return (
    <div className="stats-grid dashboard-stats">
      {cards.map((card) => {
        const content = (
          <>
            <StatCard
              label={card.label}
              value={card.value}
              tone={card.tone}
              delta={card.note}
            />
            <span className="metric-explanation">{card.hint}</span>
          </>
        );
        return card.link ? (
          <Link
            key={card.label}
            className="dashboard-metric"
            to={card.link}
            title={card.hint}
          >
            {content}
          </Link>
        ) : (
          <div
            key={card.label}
            className="dashboard-metric"
            tabIndex={0}
            title={card.hint}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
export function QueueAgePanel({ queue }: { queue: Dashboard['queueAge'] }) {
  const buckets = [
    ['До часа', queue.lt1h],
    ['1–6 часов', queue.h1to6],
    ['6–24 часа', queue.h6to24],
    ['Более суток', queue.gt24h],
  ] as const;
  const total = buckets.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section className="card dashboard-panel">
      <div className="card-head">
        <div>
          <span className="section-label">Новые и на рассмотрении</span>
          <h2>Возраст очереди</h2>
        </div>
        <strong title="Сумма незавершённых жалоб">{number(total)}</strong>
      </div>
      {total === 0 ? (
        <p className="data-note">
          Незавершённых жалоб нет. Очередь обработана.
        </p>
      ) : (
        <div className="queue-age">
          {buckets.map(([label, count], index) => (
            <div
              key={label}
              className={`queue-age-item ${index === 3 && count > 0 ? 'overdue' : ''}`}
              title={`${label}: ${count} из ${total} незавершённых жалоб`}
            >
              <span>
                {label}
                <small>{Math.round((count / total) * 100)}% очереди</small>
              </span>
              <strong>{number(count)}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="dashboard-queue-actions">
        <Link
          className="button secondary"
          to="/admin/reports?sort=age&order=desc"
        >
          Все жалобы по возрасту
        </Link>
        <Link className="button ghost" to="/admin/reports?view=mine">
          Моя очередь
        </Link>
      </div>
    </section>
  );
}
const actionLabels: Record<string, string> = {
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
const resultLabels: Record<string, string> = {
  SUCCESS: 'Успешно',
  FAILED: 'Ошибка',
  DENIED: 'Отказано',
  PENDING: 'Ожидает сверки',
};
export function RecentActionsPanel({
  events,
  canOpenAudit,
}: {
  events: Dashboard['recentActions'];
  canOpenAudit: boolean;
}) {
  return (
    <section className="card incidents">
      <div className="card-head">
        <div>
          <span className="section-label">Последние 10 событий</span>
          <h2>Административные действия</h2>
        </div>
        {canOpenAudit && <Link to="/admin/audit">Журнал</Link>}
      </div>
      {events.length ? (
        events.map((event) => (
          <div key={event.id}>
            <span
              title={event.result}
              className={`status status-${event.result === 'SUCCESS' ? 'success' : ['FAILED', 'DENIED'].includes(event.result) ? 'danger' : event.result === 'PENDING' ? 'warning' : 'neutral'}`}
            >
              <i />
              {resultLabels[event.result] ?? 'Нет данных'}
            </span>
            <span>
              <strong title={event.action}>
                {actionLabels[event.action] ?? 'Служебное действие'}
              </strong>
              <small>{event.staff?.name || 'Система'}</small>
              {event.targetType === 'REPORT' && event.targetId ? (
                <Link to={`/admin/reports/${event.targetId}`}>
                  Жалоба {event.targetId.slice(0, 8)}
                </Link>
              ) : (
                <small title={event.targetId ?? undefined}>
                  {event.targetType} {event.targetId?.slice(0, 8)}
                </small>
              )}
            </span>
            <time className="incident-date" dateTime={event.timestamp}>
              {new Date(event.timestamp).toLocaleString('ru-RU')}
            </time>
          </div>
        ))
      ) : (
        <p className="data-note">Административных действий пока нет.</p>
      )}
    </section>
  );
}
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загрузка dashboard"
      className="dashboard-skeleton"
    >
      <div className="stats-grid dashboard-stats">
        {Array.from({ length: 9 }, (_, index) => (
          <div className="skeleton dashboard-stat-skeleton" key={index} />
        ))}
      </div>
      <div className="dashboard-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="card skeleton dashboard-panel-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}
