import { useCallback, useEffect, useState } from 'react';
import {
  normalizeQueueParams,
  queueQuery,
} from '../components/moderation/queue-query';
import { useQueueAutoRefresh } from '../hooks/useQueueAutoRefresh';
import { BulkDecisionPanel } from '../components/moderation/BulkDecisionPanel';
import {
  reportPriorityLabel as priorityLabel,
  reportStatusLabel,
  reportTargetLabel as targetLabel,
  reportCategoryLabel,
} from '../types/report-labels';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { QueueFilters } from '../components/moderation/QueueFilters';
import type { Report } from '../types/domain';
import { useRefreshingQuery } from '../hooks/useRefreshingQuery';
import { adminService } from '../services/admin.service';
import { DataTable, type Column } from '../components/ui/DataTable';
import {
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';

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
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const [rawParams, setParams] = useSearchParams();
  const params = normalizeQueueParams(rawParams);
  const signature = params.toString();
  const rawSignature = rawParams.toString();
  const query = queueQuery(params);
  const page = query.page;
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refresh = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => {
    if (signature !== rawSignature) setParams(signature, { replace: true });
  }, [signature, rawSignature, setParams]);
  const state = useRefreshingQuery(
    (signal) => adminService.reports({ ...query, signal }),
    signature,
    reload,
  );
  useQueueAutoRefresh(autoRefresh, state.loading, refresh);

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
          <strong>{reportCategoryLabel(report.category)}</strong>
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
        <StatusBadge value={reportStatusLabel[report.status]} />
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
        eyebrow="Модерация"
        title="Очередь жалоб"
        actions={
          <div className="dialog-actions">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />{' '}
              Автообновление · 60 с
            </label>
            <button
              className="button secondary"
              disabled={state.loading}
              onClick={refresh}
            >
              Обновить
            </button>
          </div>
        }
        description={
          state.data
            ? `${state.data.total.toLocaleString('ru-RU')} жалоб по текущим фильтрам`
            : 'Единая очередь модерации'
        }
      />
      <p className="data-note" aria-live="polite">
        {state.updatedAt
          ? `Последнее успешное обновление: ${new Date(state.updatedAt).toLocaleTimeString('ru-RU')}`
          : 'Очередь ещё не обновлена'}
        {autoRefresh &&
          ' · В скрытой вкладке автообновление приостанавливается'}
      </p>
      <QueueFilters
        params={params}
        counts={state.data?.counts}
        onChange={update}
      />
      {selected.size > 0 && (
        <BulkDecisionPanel
          ids={[...selected]}
          onClear={() => setSelected(new Set())}
          onChanged={refresh}
        />
      )}
      {state.data && state.loading && <p role="status">Обновление очереди…</p>}
      {state.data && state.error && (
        <section role="alert">
          <ErrorState
            message={`Не удалось обновить очередь: ${state.error}. Показаны последние полученные данные.`}
          />
          <button className="button secondary" onClick={refresh}>
            Повторить загрузку
          </button>
        </section>
      )}
      {state.loading && !state.data ? (
        <LoadingState />
      ) : !state.data ? (
        <section>
          <ErrorState message={state.error ?? 'Нет данных'} />
          <button className="button secondary" onClick={refresh}>
            Повторить загрузку
          </button>
        </section>
      ) : (
        <section className="card table-card reports-table">
          <DataTable
            rows={state.data.items}
            columns={columns}
            rowKey={(report) => report.id}
            selected={selected}
            isRowSelectable={(report) =>
              report.targetType !== 'SUPPORT' &&
              ['OPEN', 'IN_REVIEW'].includes(report.status) &&
              (selected.has(report.id) || selected.size < 100)
            }
            onSelect={(id) => {
              const report = state.data?.items.find((item) => item.id === id);
              if (
                !report ||
                report.targetType === 'SUPPORT' ||
                !['OPEN', 'IN_REVIEW'].includes(report.status)
              )
                return;
              setSelected((previous) => {
                const next = new Set(previous);
                if (next.has(id)) next.delete(id);
                else if (next.size < 100) next.add(id);
                return next;
              });
            }}
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
