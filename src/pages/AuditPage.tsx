import { useSearchParams } from 'react-router-dom';
import { DataTable, type Column } from '../components/ui/DataTable';
import {
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import type { AuditEvent } from '../types/domain';

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const state = useAsync(
    (signal) => adminService.audit({ page, pageSize: 25, signal }),
    [page],
  );
  const go = (value: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(value));
    setParams(next);
  };
  const columns: Column<AuditEvent>[] = [
    {
      key: 'time',
      header: 'Время',
      render: (event) => new Date(event.timestamp).toLocaleString('ru-RU'),
    },
    {
      key: 'staff',
      header: 'Сотрудник',
      render: (event) => event.staff?.name || 'Система',
    },
    {
      key: 'action',
      header: 'Действие',
      render: (event) => <code>{event.action}</code>,
    },
    {
      key: 'target',
      header: 'Объект',
      render: (event) => (
        <span>
          {event.targetType}
          <br />
          {event.targetId && <IDDisplay value={event.targetId} />}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Причина',
      render: (event) => event.reason || '—',
    },
    {
      key: 'result',
      header: 'Результат',
      render: (event) => <StatusBadge value={event.result} />,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Журнал действий"
        description="Неизменяемая история административных операций"
      />
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <ErrorState message={state.error ?? 'Нет данных'} />
      ) : (
        <section className="card table-card">
          <DataTable
            rows={state.data.items}
            columns={columns}
            rowKey={(event) => event.id}
          />
          <div className="pagination">
            <span>Страница {page}</span>
            <div>
              <button disabled={page === 1} onClick={() => go(page - 1)}>
                ←
              </button>
              <button className="active">{page}</button>
              <button
                disabled={page * state.data.limit >= state.data.total}
                onClick={() => go(page + 1)}
              >
                →
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
