import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/Primitives';
import { SystemBadge } from '../components/dashboard/DashboardWidgets';
import { usePolling } from '../hooks/usePolling';
import { healthService } from '../services/health.service';

export function SystemPage() {
  const state = usePolling(healthService.snapshot, 30_000);
  return (
    <>
      <PageHeader
        eyebrow="Сервисы Hub"
        title="Состояние системы"
        description="Активные проверки каждые 30 секунд. Доступность сервиса и успешность пользовательского процесса — разные показатели."
        actions={
          <>
            <Link className="button secondary" to="/admin/monitor">
              Графики процессов
            </Link>
            <button
              className="button secondary"
              disabled={state.loading}
              onClick={state.refresh}
            >
              Обновить
            </button>
          </>
        }
      />
      {state.error && (
        <p className="health-stale" role="alert">
          {state.error}
          {state.data ? ' Показан последний полученный снимок.' : ''}
        </p>
      )}
      {!state.data && state.loading && <p role="status">Проверка сервисов…</p>}
      <div className="services-grid">
        {Object.entries(state.data?.services ?? {}).map(([id, service]) => (
          <article className="card service-card" key={id}>
            <SystemBadge name={service.name ?? id} value={service} />
            <p>{service.description || 'Подробности проверки недоступны.'}</p>
            <dl>
              <div>
                <dt>Последняя проверка</dt>
                <dd>
                  {service.checkedAt
                    ? new Date(service.checkedAt).toLocaleString('ru-RU')
                    : 'Ещё не выполнена'}
                </dd>
              </div>
              <div>
                <dt>Способ проверки</dt>
                <dd>
                  {service.configured === false
                    ? 'Не настроен'
                    : (service.probe ?? 'Нет данных')}
                </dd>
              </div>
              {service.reason && (
                <div>
                  <dt>Результат проверки</dt>
                  <dd>{service.reason}</dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
