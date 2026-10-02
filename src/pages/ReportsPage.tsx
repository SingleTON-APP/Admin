import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { QueueFilters } from '../components/moderation/QueueFilters';
import type {
  Report,
  ReportPriority,
  ReportStatus,
  ReportTargetType,
} from '../types/domain';
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

const priorityLabel: Record<ReportPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критичный',
};
const targetLabel: Record<ReportTargetType, string> = {
  USER: 'Пользователь',
  MESSAGE: 'Сообщение',
  CHAT: 'Чат',
  POST: 'Пост',
  COMMENT: 'Комментарий',
  MEDIA: 'Медиа',
};
const age = (value: string) => {
  const milliseconds = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(milliseconds / 3_600_000));
  return hours < 1
    ? 'меньше часа'
    : hours < 24
      ? `${hours} ч`
      : `${Math.floor(hours / 24)} д ${hours % 24} ч`;
};

export function ReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const signature = params.toString();
  const assigneeFilter = params.get('assignee');
  const selectedView = params.get('view') as
    'new' | 'mine' | 'critical' | 'unassigned' | null;
  const effectiveView =
    selectedView ??
    (assigneeFilter === 'me'
      ? 'mine'
      : assigneeFilter === 'unassigned'
        ? 'unassigned'
        : undefined);
  const state = useAsync(
    (signal) =>
      adminService.reports({
        page,
        pageSize: 25,
        search: params.get('search') ?? undefined,
        targetType: (params.get('targetType') as ReportTargetType) || undefined,
        status: (params.get('status') as ReportStatus) || undefined,
        priority: (params.get('priority') as ReportPriority) || undefined,
        assigneeId: !['me', 'unassigned'].includes(assigneeFilter ?? '')
          ? (assigneeFilter ?? undefined)
          : undefined,
        olderThanHours: Number(params.get('age')) || undefined,
        view: effectiveView,
        sort:
          (params.get('sort') as 'priority' | 'age' | 'updatedAt') ||
          'priority',
        order: (params.get('order') as 'asc' | 'desc') || 'desc',
        signal,
      }),
    [signature],
  );

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  const columns: Column<Report>[] = [
    {
      key: 'id',
      header: 'Жалоба',
      render: (report) => (
        <span className="stack-cell">
          <IDDisplay value={report.id} />
          <small>{new Date(report.createdAt).toLocaleString('ru-RU')}</small>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Цель',
      render: (report) => (
        <span className="stack-cell">
          <strong>{targetLabel[report.targetType]}</strong>
          <small title={report.targetId}>{report.targetId.slice(0, 16)}</small>
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Автор / субъект',
      render: (report) =>
        report.targetUser ? (
          <span className="stack-cell">
            <strong>@{report.targetUser.username}</strong>
            <small>{report.targetUser.publicId}</small>
          </span>
        ) : (
          <span className="data-note">Не определён</span>
        ),
    },
    {
      key: 'reason',
      header: 'Категория',
      render: (report) => (
        <span className="stack-cell">
          <strong>{report.category}</strong>
          <small className="truncate">{report.reason}</small>
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Приоритет',
      render: (report) => (
        <StatusBadge value={priorityLabel[report.priority]} />
      ),
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
      key: 'age',
      header: 'Возраст',
      render: (report) => (
        <span
          className={
            report.priority === 'CRITICAL' ||
            Date.now() - new Date(report.createdAt).getTime() > 86_400_000
              ? 'text-danger'
              : ''
          }
        >
          {age(report.createdAt)}
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Moderation"
        title="Очередь жалоб"
        description={
          state.data
            ? `${state.data.total.toLocaleString('ru-RU')} жалоб по текущим фильтрам`
            : 'Единая очередь модерации'
        }
      />
      {state.data && (
        <QueueFilters
          params={params}
          counts={state.data.counts}
          onChange={update}
        />
      )}
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <ErrorState message={state.error ?? 'Нет данных'} />
      ) : (
        <section className="card table-card reports-table">
          <DataTable
            rows={state.data.items}
            columns={columns}
            rowKey={(report) => report.id}
            rowClassName={(report) =>
              report.priority === 'CRITICAL'
                ? 'row-critical'
                : Date.now() - new Date(report.createdAt).getTime() > 86_400_000
                  ? 'row-overdue'
                  : ''
            }
            onRowClick={(report) =>
              navigate(`/admin/reports/${report.id}`, {
                state: { from: `${location.pathname}${location.search}` },
              })
            }
          />
          <div className="pagination">
            <span>
              Страница {page} · показано {state.data.items.length}
            </span>
            <div>
              <button
                aria-label="Предыдущая страница"
                disabled={page === 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                ←
              </button>
              <button className="active" aria-current="page">
                {page}
              </button>
              <button
                aria-label="Следующая страница"
                disabled={page * state.data.limit >= state.data.total}
                onClick={() => update({ page: String(page + 1) })}
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
