import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';

export function SystemPage() {
  const state = useAsync((signal) => adminService.system(signal), []);
  if (state.loading) return <LoadingState />;
  if (state.error || !state.data)
    return <ErrorState message={state.error ?? 'Нет данных'} />;
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Состояние системы"
        description="Проверки, которые фактически выполняет сервер"
      />
      <div className="services-grid">
        <article className="card service-card">
          <div className="card-head">
            <h2>API</h2>
            <StatusBadge value={state.data.api.status} />
          </div>
          <dl>
            <div>
              <dt>Версия</dt>
              <dd>{state.data.api.version}</dd>
            </div>
            <div>
              <dt>Uptime</dt>
              <dd>{Math.floor(state.data.api.uptimeSeconds / 60)} мин</dd>
            </div>
          </dl>
        </article>
        <article className="card service-card">
          <div className="card-head">
            <h2>Database</h2>
            <StatusBadge value={state.data.database.status} />
          </div>
          <dl>
            <div>
              <dt>Задержка</dt>
              <dd>{state.data.database.latencyMs} ms</dd>
            </div>
          </dl>
        </article>
      </div>
    </>
  );
}
