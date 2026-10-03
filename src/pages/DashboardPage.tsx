import { useState } from 'react';
import { UsagePanel } from '../components/dashboard/UsagePanel';
import { Link } from 'react-router-dom';
import {
  TrendChart,
  TypeDistribution,
  SystemBadge,
} from '../components/dashboard/DashboardWidgets';
import {
  DashboardMetrics,
  DashboardSkeleton,
  QueueAgePanel,
  RecentActionsPanel,
} from '../components/dashboard/DashboardPanels';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import { ErrorState, PageHeader } from '../components/ui/Primitives';

export function DashboardPage() {
  const admin = useAdmin();
  const [period, setPeriod] = useState<7 | 30>(30);
  const [reload, setReload] = useState(0);
  const state = useAsync((signal) => adminService.dashboard(signal), [reload]);
  const data = state.data;
  const manager = ['ADMIN', 'FULL_ADMIN'].includes(admin.role);
  return (
    <>
      <PageHeader
        eyebrow="Администрирование и модерация"
        title="Операционный центр"
        description={
          data
            ? `Снимок данных: ${new Date(data.generatedAt).toLocaleString('ru-RU')}`
            : 'Пользователи, контент и очередь модерации'
        }
        actions={
          <>
            <label className="dashboard-period">
              Период графиков
              <select
                aria-label="Период графиков"
                value={period}
                onChange={(event) =>
                  setPeriod(Number(event.target.value) as 7 | 30)
                }
              >
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
              </select>
            </label>
            <button
              className="button secondary"
              disabled={state.loading}
              onClick={() => setReload((value) => value + 1)}
            >
              {state.loading ? 'Обновление…' : 'Обновить'}
            </button>
            <Link className="button primary" to="/admin/reports?view=new">
              Открыть очередь
            </Link>
          </>
        }
      />
      {state.loading ? (
        <DashboardSkeleton />
      ) : state.error || !data ? (
        <>
          <ErrorState message={state.error ?? 'Нет данных'} />
          <button
            className="button secondary"
            onClick={() => setReload((value) => value + 1)}
          >
            Повторить загрузку
          </button>
        </>
      ) : (
        <>
          {data.metrics.posts24h === null && (
            <p className="dashboard-notice" role="status">
              Статистика постов недоступна. Остальные показатели получены из
              Back-Hub.
            </p>
          )}
          <DashboardMetrics metrics={data.metrics} />
          <div className="dashboard-grid">
            <section className="card dashboard-panel">
              <div className="card-head">
                <div>
                  <span className="section-label">
                    Последние {period} дней · даты по UTC
                  </span>
                  <h2>Динамика жалоб</h2>
                </div>
              </div>
              <p className="data-note">
                Количество созданных жалоб за каждый день. Текущий день по UTC
                ещё не завершён.
              </p>
              <TrendChart
                points={data.reportTrend.slice(-period)}
                label="Жалобы"
              />
            </section>
            <QueueAgePanel queue={data.queueAge} />
            <section className="card dashboard-panel">
              <div className="card-head">
                <div>
                  <span className="section-label">
                    Последние {period} дней · UTC
                  </span>
                  <h2>Регистрации и активность</h2>
                </div>
              </div>
              <p className="data-note">
                Активность — уникальные авторы сообщений за день.
              </p>
              <TrendChart
                points={data.registrationTrend.slice(-period)}
                label="Регистрации"
                secondaryLabel={
                  data.registrationTrend.some(
                    (point) => point.secondary !== undefined,
                  )
                    ? 'Авторы сообщений'
                    : undefined
                }
              />
            </section>
            <section className="card dashboard-panel">
              <div className="card-head">
                <div>
                  <span className="section-label">Последние 30 дней</span>
                  <h2>Распределение жалоб</h2>
                </div>
              </div>
              <TypeDistribution items={data.reportsByType} />
            </section>
          </div>
          <div className="dashboard-lower">
            <RecentActionsPanel
              events={data.recentActions}
              canOpenAudit={manager}
            />
            <section className="card dashboard-panel system-compact">
              <div className="card-head">
                <div>
                  <span className="section-label">На момент снимка</span>
                  <h2>Состояние системы</h2>
                </div>
                {manager && <Link to="/admin/system">Подробнее</Link>}
              </div>
              <SystemBadge name="Back-Hub API" value={data.systemStatus.api} />
              <SystemBadge
                name="PostgreSQL"
                value={data.systemStatus.database}
              />
              <SystemBadge
                name="Post-service"
                value={data.systemStatus.posts}
              />
              <p className="data-note">
                Состояние проверяется при каждом обновлении dashboard.
              </p>
            </section>
          </div>
          <UsagePanel days={period} />
        </>
      )}
    </>
  );
}
