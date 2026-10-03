import { auditActionLabel, auditTargetLabels } from '../types/audit-labels';
import { AuditResult } from '../components/audit/AuditEventDetails';
import { useSearchParams } from 'react-router-dom';
import { DataTable, type Column } from '../components/ui/DataTable';
import {
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
} from '../components/ui/Primitives';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import type { AuditEvent } from '../types/domain';
import { useState } from 'react';

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [reload, setReload] = useState(0);
  const requestedPage = Number(params.get('page'));
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= 1_000_000
      ? requestedPage
      : 1;
  const state = useAsync(
    (signal) => adminService.audit({ page, pageSize: 25, signal }),
    [page, reload],
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
      render: (event) => (
        <span title={event.action}>{auditActionLabel(event.action)}</span>
      ),
    },
    {
      key: 'target',
      header: 'Объект',
      render: (event) => (
        <span>
          {auditTargetLabels[event.targetType] ?? event.targetType}
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
      render: (event) => <AuditResult result={event.result} />,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Безопасность"
        title="Журнал действий"
        description="Неизменяемая история административных операций"
        actions={
          <button
            className="button secondary"
            disabled={state.loading}
            onClick={() => setReload((value) => value + 1)}
          >
            Обновить журнал
          </button>
        }
      />
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <section>
          <ErrorState message={state.error ?? 'Нет данных'} />
          <button
            className="button secondary"
            onClick={() => setReload((value) => value + 1)}
          >
            Повторить загрузку
          </button>
        </section>
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
              <button
                aria-label="Предыдущая страница журнала"
                disabled={page === 1}
                onClick={() => go(page - 1)}
              >
                ←
              </button>
              <span aria-current="page">{page}</span>
              <button
                aria-label="Следующая страница журнала"
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
