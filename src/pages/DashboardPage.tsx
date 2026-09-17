import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/ui/Primitives';

const number = (value: number) => value.toLocaleString('ru-RU');
const date = (value: string) => new Date(value).toLocaleString('ru-RU');

export function DashboardPage() {
  const state = useAsync((signal) => adminService.dashboard(signal), []);
  if (state.loading) return <LoadingState />;
  if (state.error || !state.data)
    return <ErrorState message={state.error ?? 'Нет данных'} />;
  const data = state.data;
  const cards: Array<[string, string]> = [
    ['Всего пользователей', number(data.totalUsers)],
    ['Активны за 24 часа', number(data.activeUsers)],
    ['Новые за 24 часа', number(data.newUsers)],
    ['Заблокированы', number(data.bannedUsers)],
    ['Открытые жалобы', number(data.openReports)],
    ['На рассмотрении', number(data.reviewReports)],
    ['Закрытые жалобы', number(data.resolvedReports)],
    ['Действия сотрудников', number(data.actionCount)],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Обзор"
        title="Операционный центр"
        description="Актуальные показатели из API администрирования"
      />
      <div className="stats-grid">
        {cards.map(([label, value], index) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            tone={index === 4 ? 'warning' : 'default'}
          />
        ))}
      </div>
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
              <span className="incident-date">{date(event.timestamp)}</span>
            </div>
          ))
        ) : (
          <p className="data-note">Действий пока нет.</p>
        )}
      </section>
    </>
  );
}
