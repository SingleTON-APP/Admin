import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import { adminService } from '../services/admin.service';
import { usageService } from '../services/usage.service';
import {
  TrendChart,
  TypeDistribution,
} from '../components/dashboard/DashboardWidgets';
import {
  DashboardMetrics,
  QueueAgePanel,
} from '../components/dashboard/DashboardPanels';
import { UsagePanel } from '../components/dashboard/UsagePanel';
import { PageHeader } from '../components/ui/Primitives';
import { processMetricsService } from '../services/process-metrics.service';
import { ProcessMetricsPanel } from '../components/dashboard/ProcessMetricsPanel';

const tiles = [
  ['processes', 'Процессы и задержки'],
  ['metrics', 'Основные показатели'],
  ['registrations', 'Регистрации и активность'],
  ['reports', 'Динамика жалоб'],
  ['queue', 'Возраст очереди'],
  ['types', 'Типы жалоб'],
  ['categories', 'Причины жалоб'],
  ['resolution', 'Обработка жалоб'],
  ['usage', 'Время пользователей сайта'],
] as const;
type Tile = (typeof tiles)[number][0];
const defaults = {
  minutes: 15 as 15 | 60,
  seconds: 30,
  days: 7 as 7 | 30,
  columns: 2,
  compact: false,
  visible: tiles.map(([id]) => id),
  order: tiles.map(([id]) => id),
};
function readSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('admin-monitor-settings') || 'null',
    );
    if (!saved || typeof saved !== 'object') return defaults;
    const ids = tiles.map(([id]) => id);
    const order: Tile[] = Array.isArray(saved.order)
      ? [...new Set<Tile>(saved.order.filter((id: Tile) => ids.includes(id)))]
      : [];
    return {
      minutes: (saved.minutes === 60 ? 60 : 15) as 15 | 60,
      seconds: [0, 5, 15, 30, 60, 120, 300].includes(saved.seconds)
        ? saved.seconds
        : defaults.seconds,
      days: (saved.days === 30 ? 30 : 7) as 7 | 30,
      columns: [1, 2, 3].includes(saved.columns)
        ? saved.columns
        : defaults.columns,
      compact: saved.compact === true,
      visible: Array.isArray(saved.visible)
        ? ids.filter(
            (id) =>
              saved.visible.includes(id) ||
              (!saved.order?.includes(id) &&
                ['processes', 'categories', 'resolution'].includes(id)),
          )
        : ids,
      order: [...order, ...ids.filter((id) => !order.includes(id))],
    };
  } catch {
    return defaults;
  }
}

function MonitorBoard({
  minutes,
  days,
  seconds,
  columns,
  compact,
  visible,
  order,
  move,
}: ReturnType<typeof readSettings> & {
  move: (id: Tile, direction: number) => void;
}) {
  const loadUsage = useCallback(
    (signal: AbortSignal) => usageService.summary(days, signal),
    [days],
  );
  const dashboard = usePolling(adminService.dashboard, seconds * 1000);
  const usage = usePolling(loadUsage, seconds * 1000);
  const loadProcesses = useCallback(
    (signal: AbortSignal) => processMetricsService.snapshot(minutes, signal),
    [minutes],
  );
  const processes = usePolling(loadProcesses, seconds * 1000);
  const data = dashboard.data;
  const loading = dashboard.loading || usage.loading || processes.loading;
  const stale = !!(dashboard.error || usage.error || processes.error);
  const hasSnapshot = !!(
    dashboard.updatedAt ||
    usage.updatedAt ||
    processes.updatedAt
  );
  return (
    <>
      <div className="monitor-status" role="status">
        <span
          className={`monitor-indicator ${stale ? 'is-stale' : !hasSnapshot ? 'is-unknown' : ''}`}
        />
        <strong>
          {stale
            ? 'Часть данных не обновлена'
            : loading
              ? 'Обновление…'
              : seconds
                ? 'Автообновление включено'
                : 'Ручное обновление'}
        </strong>
        <button
          className="button secondary"
          onClick={() => {
            dashboard.refresh();
            usage.refresh();
            processes.refresh();
          }}
          disabled={loading}
        >
          Обновить сейчас
        </button>
      </div>
      <div className="monitor-freshness" aria-live="polite">
        <ResourceFreshness label="Показатели и графики" state={dashboard} />
        <ResourceFreshness label="Время использования" state={usage} />
        <ResourceFreshness label="Процессы" state={processes} />
      </div>
      <div
        className={`monitor-grid ${compact ? 'monitor-dense' : ''}`}
        style={{ '--monitor-columns': columns } as CSSProperties}
      >
        {order
          .filter((id) => visible.includes(id))
          .map((id) => (
            <section key={id} className={`monitor-tile monitor-tile-${id}`}>
              <div className="monitor-tile-head">
                <h2>{tiles.find(([key]) => key === id)?.[1]}</h2>
                <div className="monitor-tile-controls">
                  <button
                    type="button"
                    aria-label={`Переместить выше: ${tiles.find(([key]) => key === id)?.[1]}`}
                    disabled={order.indexOf(id) === 0}
                    onClick={() => move(id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Переместить ниже: ${tiles.find(([key]) => key === id)?.[1]}`}
                    disabled={order.indexOf(id) === order.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
              {id !== 'usage' && id !== 'processes' && !data && (
                <p>{dashboard.error || 'Загрузка показателей…'}</p>
              )}
              {id === 'processes' &&
                (processes.data ? (
                  <ProcessMetricsPanel snapshot={processes.data} />
                ) : (
                  <p>{processes.error || 'Загрузка замеров процессов…'}</p>
                ))}
              {id === 'metrics' && data && (
                <DashboardMetrics metrics={data.metrics} />
              )}
              {id === 'registrations' && data && (
                <>
                  <p className="data-note">
                    Последние {days} дней · UTC. Активность — авторы сообщений,
                    а не посещения админки.
                  </p>
                  <TrendChart
                    points={data.registrationTrend.slice(-days)}
                    label="Регистрации"
                    secondaryLabel="Авторы сообщений"
                  />
                </>
              )}
              {id === 'reports' && data && (
                <>
                  <p className="data-note">
                    Созданные жалобы за последние {days} дней · UTC
                  </p>
                  <TrendChart
                    points={data.reportTrend.slice(-days)}
                    label="Жалобы"
                  />
                </>
              )}
              {id === 'queue' && data && (
                <QueueAgePanel queue={data.queueAge} />
              )}
              {id === 'types' && data && (
                <TypeDistribution items={data.reportsByType} />
              )}
              {id === 'categories' && data && (
                <ReportBars
                  items={data.reportsByCategory}
                  label="Причины жалоб · последние 30 дней, UTC"
                />
              )}
              {id === 'resolution' && data && (
                <>
                  <p className="data-note">
                    Последние {days} дней · UTC, по дате последнего решения.
                    Текущие закрытые жалобы; не история всех смен статуса.
                  </p>
                  {data.reportResolutionTrend ? (
                    <TrendChart
                      points={data.reportResolutionTrend
                        .slice(-days)
                        .map((point) => ({
                          date: point.date,
                          count: point.resolved,
                          secondary: point.rejected,
                        }))}
                      label="Решено"
                      secondaryLabel="Отклонено"
                    />
                  ) : (
                    <p className="data-note">
                      Сбор статистики решений ещё не подключён.
                    </p>
                  )}
                  <ReportBars
                    items={data.reportOutcomes}
                    label="Текущие статусы · за всё время"
                  />
                </>
              )}
              {id === 'usage' &&
                (usage.data ? (
                  <UsagePanel days={days} snapshot={usage.data} />
                ) : (
                  <p>{usage.error || 'Загрузка времени использования…'}</p>
                ))}
            </section>
          ))}
      </div>
      {visible.length === 0 && (
        <p className="dashboard-notice">
          Выберите хотя бы одну плитку в настройках.
        </p>
      )}
    </>
  );
}

const reportLabels: Record<string, string> = {
  NEW: 'Новые',
  OPEN: 'Новые',
  IN_REVIEW: 'На рассмотрении',
  RESOLVED: 'Решены',
  REJECTED: 'Отклонены',
  SPAM: 'Спам',
  ABUSE: 'Оскорбления',
  HARASSMENT: 'Травля',
  ILLEGAL: 'Запрещённый контент',
  OTHER: 'Другое',
  OTHER_CATEGORIES: 'Остальные причины',
  UNCATEGORIZED: 'Без категории',
  UNKNOWN: 'Другие статусы',
};
function ReportBars({
  items,
  label,
}: {
  items?: Array<{ label: string; value: number }>;
  label: string;
}) {
  if (!items) return <p className="data-note">Статистика ещё не подключена.</p>;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <p className="data-note">Жалоб пока нет.</p>;
  return (
    <div className="bar-list">
      <p className="data-note">{label}</p>
      {items.map((item) => (
        <div className="distribution-row" key={item.label}>
          <span>{reportLabels[item.label] ?? item.label}</span>
          <div aria-hidden="true">
            <i style={{ width: `${(item.value / total) * 100}%` }} />
          </div>
          <strong>{item.value.toLocaleString('ru-RU')}</strong>
        </div>
      ))}
    </div>
  );
}

function ResourceFreshness({
  label,
  state,
}: {
  label: string;
  state: { updatedAt?: number; error?: string; loading: boolean };
}) {
  return (
    <p className={state.error ? 'health-stale' : ''}>
      <strong>{label}:</strong>{' '}
      {state.updatedAt
        ? `последнее успешное обновление ${new Date(state.updatedAt).toLocaleTimeString('ru-RU')}`
        : 'успешных обновлений пока нет'}
      {state.error
        ? ` · ${state.updatedAt ? 'показаны устаревшие данные' : 'данные недоступны'}. ${state.error}`
        : state.loading
          ? ' · обновление…'
          : ''}
    </p>
  );
}

export function MonitorPage() {
  const [settings, setSettings] = useState(readSettings);
  const [wall, setWall] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('admin-monitor-settings', JSON.stringify(settings));
    } catch {
      // Storage can be disabled; settings still work for the current session.
    }
  }, [settings]);
  useEffect(() => {
    document.documentElement.classList.toggle('monitor-wall-mode', wall);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWall(false);
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) setWall(false);
    };
    window.addEventListener('keydown', escape);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      document.documentElement.classList.remove('monitor-wall-mode');
      window.removeEventListener('keydown', escape);
      document.removeEventListener('fullscreenchange', fullscreen);
    };
  }, [wall]);
  const toggleWall = async () => {
    if (!wall) {
      setWall(true);
      await document.documentElement
        .requestFullscreen?.()
        .catch(() => undefined);
    } else {
      setWall(false);
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => undefined);
    }
  };
  const move = (id: Tile, direction: number) =>
    setSettings((previous) => {
      const order = [...previous.order];
      const from = order.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return previous;
      const current = order[from]!;
      order[from] = order[to]!;
      order[to] = current;
      return { ...previous, order };
    });
  return (
    <div className="monitor-page">
      <PageHeader
        eyebrow="Hub · мониторинг"
        title="Живой экран"
        description="Задержки процессов, пользователи сайта и очередь модерации. Настройки сохраняются на этом компьютере."
        actions={
          <>
            <Link to="/admin" className="button secondary">
              Обзор
            </Link>
            <button
              className="button primary"
              onClick={() => void toggleWall()}
            >
              {wall ? 'Выйти из режима монитора' : 'На весь экран'}
            </button>
          </>
        }
      />
      <details className="monitor-settings">
        <summary>Настроить экран</summary>
        <div className="monitor-settings-fields">
          <label>
            Окно процессов
            <select
              aria-label="Окно процессов"
              value={settings.minutes}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  minutes: Number(event.target.value) as 15 | 60,
                }))
              }
            >
              <option value={15}>15 минут</option>
              <option value={60}>60 минут</option>
            </select>
          </label>
          <label>
            Обновление
            <select
              aria-label="Интервал обновления мониторинга"
              value={settings.seconds}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  seconds: Number(event.target.value),
                }))
              }
            >
              {[0, 5, 15, 30, 60, 120, 300].map((value) => (
                <option key={value} value={value}>
                  {value ? `${value} секунд` : 'Вручную'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Период
            <select
              aria-label="Период мониторинга"
              value={settings.days}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  days: Number(event.target.value) as 7 | 30,
                }))
              }
            >
              <option value={7}>7 дней</option>
              <option value={30}>30 дней</option>
            </select>
          </label>
          <label>
            Колонки
            <select
              aria-label="Колонки мониторинга"
              value={settings.columns}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  columns: Number(event.target.value),
                }))
              }
            >
              {[1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="monitor-check">
            <input
              type="checkbox"
              checked={settings.compact}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  compact: event.target.checked,
                }))
              }
            />
            Компактные плитки
          </label>
          <button
            className="button secondary"
            onClick={() => setSettings(defaults)}
          >
            Сбросить настройки
          </button>
        </div>
        <div className="monitor-toggles">
          {tiles.map(([id, title]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={settings.visible.includes(id)}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    visible: event.target.checked
                      ? [...previous.visible, id]
                      : previous.visible.filter((value) => value !== id),
                  }))
                }
              />
              {title}
            </label>
          ))}
        </div>
      </details>
      <MonitorBoard
        key={`${settings.days}:${settings.minutes}`}
        {...settings}
        move={move}
      />
    </div>
  );
}
