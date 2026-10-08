import { useState } from 'react';
import {
  healthService,
  type ServiceHealth,
} from '../../services/health.service';
import { usePolling } from '../../hooks/usePolling';
import { Dialog } from '../ui/Dialog';
import '../../styles/sidebar-health.css';

const intervals = [5, 15, 30, 60, 120, 300];
const primary = ['api', 'database', 'redis', 'messages', 'calls'];
const names: Record<string, string> = {
  api: 'API',
  database: 'PostgreSQL',
  redis: 'Redis',
  messages: 'Сообщения / WebSocket',
  calls: 'Звонки',
  posts: 'Публикации',
  auth: 'Авторизация',
  search: 'Поиск',
  storage: 'Файлы',
};
const statuses = {
  HEALTHY: 'Работает',
  DEGRADED: 'Сбои',
  DOWN: 'Недоступен',
  UNKNOWN: 'Нет данных',
};

export function SidebarHealth() {
  const [allOpen, setAllOpen] = useState(false);
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
  const promoted = Object.entries(services ?? {})
    .filter(
      ([id, value]) =>
        !primary.includes(id) &&
        value.configured !== false &&
        ['DOWN', 'DEGRADED'].includes(value.status),
    )
    .map(([id]) => id);
  const displayed = [...primary, ...promoted];
  const all = [
    ...new Set([...Object.keys(names), ...Object.keys(services ?? {})]),
  ];
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
      <ul
        className={`sidebar-health-services ${state.error ? 'health-services-stale' : ''}`}
        aria-busy={state.loading}
        aria-label="Основные сервисы и обнаруженные сбои"
      >
        {displayed.map((id) => (
          <HealthRow
            key={id}
            id={id}
            value={services?.[id] ?? unknown}
            stale={!!state.error}
          />
        ))}
      </ul>
      <button
        className="sidebar-health-all"
        type="button"
        onClick={() => setAllOpen(true)}
        aria-label="Все сервисы"
      >
        Все сервисы{promoted.length ? ` · сбоев: ${promoted.length}` : ''}
      </button>
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
      <Dialog
        open={allOpen}
        title="Состояние всех сервисов"
        onClose={() => setAllOpen(false)}
      >
        <div className="health-details">
          <p className="data-note">
            Результат относится к указанному времени проверки. Отсутствие данных
            или ошибка загрузки не подтверждают падение сервиса.
          </p>
          {state.error && (
            <p className="health-stale" role="alert">
              Не удалось обновить проверку. {state.error}
            </p>
          )}
          <ul className={state.error ? 'health-details-stale' : ''}>
            {all.map((id) => (
              <HealthRow
                key={id}
                id={id}
                value={services?.[id] ?? unknown}
                stale={!!state.error}
                detailed
              />
            ))}
          </ul>
          <button
            className="button secondary"
            type="button"
            disabled={state.loading}
            onClick={state.refresh}
          >
            Обновить проверку
          </button>
        </div>
      </Dialog>
    </section>
  );
}

function HealthRow({
  id,
  value,
  stale,
  detailed = false,
}: {
  id: string;
  value: ServiceHealth;
  stale: boolean;
  detailed?: boolean;
}) {
  const status = value.configured === false ? 'UNKNOWN' : value.status;
  const label =
    value.configured === false
      ? 'Не настроен'
      : statuses[status] || statuses.UNKNOWN;
  const latency =
    typeof value.latencyMs === 'number' && Number.isFinite(value.latencyMs)
      ? `${value.latencyMs.toLocaleString('ru-RU')} мс`
      : '—';
  const checked = value.checkedAt
    ? new Date(value.checkedAt).toLocaleString('ru-RU')
    : 'Время проверки не получено';
  return (
    <li
      className={`sidebar-health-row health-row-${status.toLowerCase()} ${stale ? 'health-row-stale' : ''}`}
      title={`${names[id] || id}: ${label}. ${checked}${value.reason ? `. ${value.reason}` : ''}`}
    >
      <span
        className="health-row-dot"
        role="img"
        aria-label={`${label}${stale ? ' (предыдущая проверка)' : ''}`}
      />
      <span className="health-row-name">{names[id] || id}</span>
      <span className="health-row-latency">
        {status === 'DOWN'
          ? 'Сбой'
          : status === 'UNKNOWN'
            ? 'Нет данных'
            : latency}
      </span>
      {detailed && (
        <div className="health-row-detail">
          <strong>
            {label}
            {stale ? ' · данные устарели' : ''}
          </strong>
          <span>{checked}</span>
          {value.probe && <span>Проверка: {value.probe}</span>}
          {value.reason && <span>{value.reason}</span>}
        </div>
      )}
    </li>
  );
}
