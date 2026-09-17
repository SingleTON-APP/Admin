import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Report } from '../types/domain';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import { DataTable, type Column } from '../components/ui/DataTable';
import {
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';

export function ReportsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const state = useAsync(
    (signal) => adminService.reports({ page, pageSize: 25, status, signal }),
    [page, status],
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const columns: Column<Report>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (report) => <IDDisplay value={report.id} />,
    },
    { key: 'type', header: 'Объект', render: (report) => report.targetType },
    {
      key: 'target',
      header: 'Пользователь',
      render: (report) => (
        <span>
          @{report.targetUser.username}
          <br />
          <small>{report.targetUser.publicId}</small>
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Причина жалобы',
      render: (report) => <span className="truncate">{report.reason}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      render: (report) => (
        <StatusBadge value={report.status.replace('_', ' ')} />
      ),
    },
    {
      key: 'assignee',
      header: 'Исполнитель',
      render: (report) => report.assignee?.name || 'Не назначен',
    },
    {
      key: 'created',
      header: 'Создана',
      render: (report) => new Date(report.createdAt).toLocaleString('ru-RU'),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Moderation"
        title="Жалобы"
        description={
          state.data ? `${state.data.total} в выбранной очереди` : undefined
        }
      />
      <div className="filter-bar">
        <select
          value={status}
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <ErrorState message={state.error ?? 'Нет данных'} />
      ) : (
        <section className="card table-card">
          <DataTable
            rows={state.data.items}
            columns={columns}
            rowKey={(report) => report.id}
            onRowClick={(report) => navigate(`/admin/reports/${report.id}`)}
          />
          <div className="pagination">
            <span>Страница {page}</span>
            <div>
              <button
                disabled={page === 1}
                onClick={() => update('page', String(page - 1))}
              >
                ←
              </button>
              <button className="active">{page}</button>
              <button
                disabled={page * state.data.limit >= state.data.total}
                onClick={() => update('page', String(page + 1))}
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
