import { Link } from 'react-router-dom';
import {
  TrendChart,
  TypeDistribution,
  SystemBadge,
} from '../components/dashboard/DashboardWidgets';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/ui/Primitives';

const number = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('ru-RU');
const duration = (minutes: number | null) => {
  if (minutes === null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} мин`;
  return `${Math.floor(minutes / 60)} ч ${Math.round(minutes % 60)} мин`;
};
const metricHints: Record<string, string> = {
  'Всего пользователей': 'Все зарегистрированные пользователи',
  'Активны за 24 часа':
    'Уникальные пользователи с активностью за последние 24 часа',
  'Новые за 24 часа': 'Регистрации за последние 24 часа',
  'Сообщения за 24 часа': 'Созданные сообщения за последние 24 часа',
  'Посты за 24 часа': 'Созданные посты за последние 24 часа',
  'Открытые жалобы': 'Новые жалобы, которые ещё не взяты в работу',
  'На рассмотрении': 'Жалобы со статусом «На рассмотрении»',
  'Среднее время решения': 'Среднее время от создания до завершения жалобы',
  'Высокий приоритет': 'Открытые жалобы с приоритетом HIGH или CRITICAL',
};

export function DashboardPage() {
  const state = useAsync((signal) => adminService.dashboard(signal), []);
  if (state.loading)
    return (
      <>
        <PageHeader eyebrow="Обзор" title="Операционный центр" />
        <LoadingState />
      </>
    );
  if (state.error || !state.data)
    return <ErrorState message={state.error ?? 'Нет данных'} />;
  const data = state.data;
  const cards: Array<[string, string, string]> = [
    ['Всего пользователей', number(data.metrics.totalUsers), 'default'],
    ['Активны за 24 часа', number(data.metrics.activeUsers24h), 'default'],
    ['Новые за 24 часа', number(data.metrics.newUsers24h), 'default'],
    ['Сообщения за 24 часа', number(data.metrics.messages24h), 'default'],
    ['Посты за 24 часа', number(data.metrics.posts24h), 'default'],
    ['Открытые жалобы', number(data.metrics.openReports), 'warning'],
    ['На рассмотрении', number(data.metrics.inReviewReports), 'default'],
    [
      'Среднее время решения',
      duration(data.metrics.avgResolutionMinutes),
      'default',
    ],
    ['Высокий приоритет', number(data.metrics.highPriorityReports), 'danger'],
  ];
  const queue = [
    ['До часа', data.queueAge.lt1h],
    ['1–6 часов', data.queueAge.h1to6],
    ['6–24 часа', data.queueAge.h6to24],
    ['Более суток', data.queueAge.gt24h],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Operations / Moderation"
        title="Операционный центр"
        description={`Данные обновлены ${new Date(data.generatedAt).toLocaleString('ru-RU')}`}
        actions={
          <Link className="button primary" to="/admin/reports?view=new">
            Открыть очередь
          </Link>
        }
      />
      <div className="stats-grid dashboard-stats">
        {cards.map(([label, value, tone]) => (
          <div key={label} title={metricHints[label]}>
            <StatCard label={label} value={value} tone={tone} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card dashboard-panel">
          <div className="card-head">
            <div>
              <span className="section-label">7 / 30 дней</span>
              <h2>Динамика жалоб</h2>
            </div>
          </div>
          <TrendChart points={data.reportTrend} label="Жалобы" />
        </section>
        <section className="card dashboard-panel">
          <div className="card-head">
            <div>
              <span className="section-label">Очередь</span>
              <h2>Возраст жалоб</h2>
            </div>
            <Link to="/admin/reports?sort=age&order=desc">Все жалобы</Link>
          </div>
          <div className="queue-age">
            {queue.map(([label, value], index) => (
              <Link
                key={String(label)}
                className={index === 3 && Number(value) > 0 ? 'overdue' : ''}
                to={
                  index === 0
                    ? '/admin/reports?view=new&sort=age&order=asc'
                    : `/admin/reports?age=${[0, 1, 6, 24][index]}&sort=age&order=desc`
                }
              >
                <span>{label}</span>
                <strong>{Number(value).toLocaleString('ru-RU')}</strong>
              </Link>
            ))}
          </div>
        </section>
        <section className="card dashboard-panel">
          <div className="card-head">
            <div>
              <span className="section-label">Тип цели</span>
              <h2>Распределение жалоб</h2>
            </div>
          </div>
          <TypeDistribution items={data.reportsByType} />
        </section>
        <section className="card dashboard-panel">
          <div className="card-head">
            <div>
              <span className="section-label">30 дней</span>
              <h2>Регистрации и активность</h2>
            </div>
          </div>
          <TrendChart
            points={data.registrationTrend}
            label="Регистрации"
            secondaryLabel={
              data.registrationTrend.some(
                (point) => point.secondary !== undefined,
              )
                ? 'Активность'
                : undefined
            }
          />
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="card incidents">
          <div className="card-head">
            <div>
              <span className="section-label">Audit</span>
              <h2>Последние действия</h2>
            </div>
            <Link to="/admin/audit">Открыть журнал</Link>
          </div>
          {data.recentActions.length ? (
            data.recentActions.map((event) => (
              <div key={event.id}>
                <StatusBadge value={event.result} />
                <span>
                  <strong>{event.action.replaceAll('_', ' ')}</strong>
                  <small>
                    {event.staff?.name || 'Система'} · {event.targetType}{' '}
                    {event.targetId ?? ''}
                  </small>
                </span>
                <span className="incident-date">
                  {new Date(event.timestamp).toLocaleString('ru-RU')}
                </span>
              </div>
            ))
          ) : (
            <p className="data-note">Административных действий пока нет.</p>
          )}
        </section>
        <section className="card dashboard-panel system-compact">
          <div className="card-head">
            <div>
              <span className="section-label">Live</span>
              <h2>Состояние системы</h2>
            </div>
            <Link to="/admin/system">Подробнее</Link>
          </div>
          <SystemBadge name="Back-Hub API" value={data.systemStatus.api} />
          <SystemBadge name="PostgreSQL" value={data.systemStatus.database} />
          <SystemBadge name="Post service" value={data.systemStatus.posts} />
        </section>
      </div>
    </>
  );
}
