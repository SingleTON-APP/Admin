import { useState } from 'react';
import { healthService } from '../../services/health.service';
import { usePolling } from '../../hooks/usePolling';
import { SystemBadge } from '../dashboard/DashboardWidgets';

const intervals = [5, 15, 30, 60, 120, 300];
export function SidebarHealth() {
  const [seconds, setSeconds] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('admin-health-interval'));
      return intervals.includes(saved) ? saved : 30;
    } catch {
      return 30;
    }
  });
  const state = usePolling(healthService.snapshot, seconds * 1000);
  const unknown = { status: 'UNKNOWN' as const };
  const services = state.data?.services;
  return (
    <section className="sidebar-health" aria-label="Состояние системы">
      <div className="sidebar-health-head">
        <h2>Состояние системы</h2>
        <select
          aria-label="Интервал обновления статусов"
          value={seconds}
          onChange={(event) => {
            const value = Number(event.target.value);
            setSeconds(value);
            try {
              localStorage.setItem('admin-health-interval', String(value));
            } catch {
              // Keep the selected interval even when storage is disabled.
            }
          }}
        >
          {intervals.map((value) => (
            <option key={value} value={value}>
              {value} с
            </option>
          ))}
        </select>
      </div>
      <div
        className={`sidebar-health-services ${state.error ? 'health-services-stale' : ''}`}
        aria-busy={state.loading}
      >
        <SystemBadge name="Back-Hub API" value={services?.api ?? unknown} />
        <SystemBadge name="PostgreSQL" value={services?.database ?? unknown} />
        <SystemBadge name="Post-service" value={services?.posts ?? unknown} />
      </div>
      {state.error && (
        <p className="health-stale health-freshness" role="status">
          {state.updatedAt
            ? 'Статусы устарели: связь для проверки недоступна.'
            : 'Не удалось проверить сервисы.'}
        </p>
      )}
      <div className="sidebar-health-footer">
        <span className={state.error ? 'health-stale' : ''} title={state.error}>
          {state.error
            ? state.updatedAt
              ? `Последняя проверка ${new Date(state.updatedAt).toLocaleTimeString('ru-RU')}`
              : 'Успешных проверок пока нет'
            : state.updatedAt
              ? `Обновлено ${new Date(state.updatedAt).toLocaleTimeString('ru-RU')}`
              : 'Проверяем сервисы…'}
        </span>
        <button
          type="button"
          onClick={state.refresh}
          disabled={state.loading}
          aria-label="Обновить статусы"
          title="Обновить статусы"
        >
          ↻
        </button>
      </div>
      <div className="environment">
        <i />
        Production
      </div>
    </section>
  );
}
