import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import { adminService } from '../services/admin.service';
import { usageService, type UsageSummary } from '../services/usage.service';
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

const tiles = [
  ['metrics', 'Основные показатели'],
  ['registrations', 'Регистрации и активность'],
  ['reports', 'Динамика жалоб'],
  ['queue', 'Возраст очереди'],
  ['types', 'Типы жалоб'],
  ['usage', 'Время пользователей сайта'],
] as const;
type Tile = (typeof tiles)[number][0];
const defaults = {
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
      seconds: [0, 5, 15, 30, 60, 120, 300].includes(saved.seconds)
        ? saved.seconds
        : defaults.seconds,
      days: (saved.days === 30 ? 30 : 7) as 7 | 30,
      columns: [1, 2, 3].includes(saved.columns)
        ? saved.columns
        : defaults.columns,
      compact: saved.compact === true,
      visible: Array.isArray(saved.visible)
        ? ids.filter((id) => saved.visible.includes(id))
        : ids,
      order: [...order, ...ids.filter((id) => !order.includes(id))],
    };
  } catch {
    return defaults;
  }
}

function MonitorBoard({
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
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [dashboard, usage] = await Promise.all([
        adminService.dashboard(signal),
        usageService
          .summary(days, signal)
          .then((data) => ({ data, error: undefined as string | undefined }))
          .catch((error: unknown) => ({
            data: undefined as UsageSummary | undefined,
            error:
              error instanceof Error ? error.message : 'Измерения недоступны',
          })),
      ]);
      return { dashboard, usage };
    },
    [days],
  );
  const state = usePolling(load, seconds * 1000);
  const data = state.data?.dashboard;
  const usage = state.data?.usage;
  return (
    <>
      <div className="monitor-status" role="status">
        <span
          className={`monitor-indicator ${state.error ? 'is-stale' : ''}`}
        />
        <strong>
          {state.error
            ? 'Нет связи с сервером'
            : state.loading
              ? 'Обновление…'
              : seconds
                ? 'Автообновление включено'
                : 'Ручное обновление'}
        </strong>
        <span>
          {state.updatedAt
            ? `Последний снимок: ${new Date(state.updatedAt).toLocaleTimeString('ru-RU')}`
            : 'Получаем первый снимок'}
        </span>
        {state.error && (
          <span>Показаны последние полученные данные. {state.error}</span>
        )}
        <button
          className="button secondary"
          onClick={state.refresh}
          disabled={state.loading}
        >
          Обновить сейчас
        </button>
      </div>
      {!data ? (
        <section className="card">
          <p>{state.error || 'Загрузка показателей…'}</p>
        </section>
      ) : (
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
                {id === 'metrics' && (
                  <DashboardMetrics metrics={data.metrics} />
                )}
                {id === 'registrations' && (
                  <>
                    <p className="data-note">
                      Последние {days} дней · UTC. Активность — авторы
                      сообщений, а не посещения админки.
                    </p>
                    <TrendChart
                      points={data.registrationTrend.slice(-days)}
                      label="Регистрации"
                      secondaryLabel="Авторы сообщений"
                    />
                  </>
                )}
                {id === 'reports' && (
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
                {id === 'queue' && <QueueAgePanel queue={data.queueAge} />}
                {id === 'types' && (
                  <TypeDistribution items={data.reportsByType} />
                )}
                {id === 'usage' &&
                  (usage?.error ? (
                    <p role="alert">
                      Время использования недоступно: {usage.error}
                    </p>
                  ) : (
                    <UsagePanel days={days} snapshot={usage?.data} />
                  ))}
              </section>
            ))}
        </div>
      )}
      {visible.length === 0 && (
        <p className="dashboard-notice">
          Выберите хотя бы одну плитку в настройках.
        </p>
      )}
    </>
  );
}

export function MonitorPage() {
  const [settings, setSettings] = useState(readSettings);
  const [wall, setWall] = useState(false);
  useEffect(() => {
    localStorage.setItem('admin-monitor-settings', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    document.documentElement.classList.toggle('monitor-wall-mode', wall);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWall(false);
    };
    window.addEventListener('keydown', escape);
    return () => {
      document.documentElement.classList.remove('monitor-wall-mode');
      window.removeEventListener('keydown', escape);
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
        description="Пользователи сайта и очередь модерации. Настройки сохраняются на этом компьютере."
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
      <MonitorBoard key={settings.days} {...settings} move={move} />
    </div>
  );
}
