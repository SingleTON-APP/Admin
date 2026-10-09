import { useState, type FormEvent } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import {
  operationsService,
  type GroupDecision,
} from '../services/operations-v2.service';
import { ApiError } from '../api/contracts';
import { Dialog } from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/Primitives';
import {
  reportTargetLabel,
  reportPriorityLabel,
  reportStatusLabel,
} from '../types/report-labels';
import '../styles/operations-v2.css';
export function ReportGroupsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') || '';
  const search = params.get('search') || '';
  const targetType = params.get('targetType') || '';
  const state = useAsync(
    (signal) =>
      operationsService.groups({ page, status, search, targetType }, signal),
    [page, status, search, targetType],
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Модерация"
        title="Группы жалоб"
        description="Жалобы на один объект и источник. Решение применяется только к выбранным жалобам."
        actions={
          <Link className="button secondary" to="/admin/reports">
            Обычная очередь
          </Link>
        }
      />
      <div className="operations-controls">
        <label>
          Поиск
          <input
            value={search}
            onChange={(event) => update('search', event.target.value)}
          />
        </label>
        <label>
          Статус
          <select
            value={status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">Все статусы</option>
            {Object.entries(reportStatusLabel).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тип объекта
          <select
            value={targetType}
            onChange={(event) => update('targetType', event.target.value)}
          >
            <option value="">Все типы</option>
            {Object.entries(reportTargetLabel).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data ? (
        <section className="card operations-scroll">
          <table>
            <thead>
              <tr>
                <th>Объект</th>
                <th>Жалобы / открытые</th>
                <th>Приоритет</th>
                <th>Первое / последнее событие</th>
              </tr>
            </thead>
            <tbody>
              {state.data.items.map((group) => (
                <tr key={group.groupKey}>
                  <th>
                    <Link
                      to={`/admin/report-groups/${group.groupKey}`}
                      state={{ from: `/admin/report-groups?${params}` }}
                    >
                      {reportTargetLabel[group.targetType]} ·{' '}
                      {group.targetId.slice(0, 12)}
                    </Link>
                  </th>
                  <td>
                    {group.count} / {group.openCount}
                  </td>
                  <td>{reportPriorityLabel[group.highestPriority]}</td>
                  <td>
                    {new Date(group.oldestAt).toLocaleString('ru-RU')} /{' '}
                    {new Date(group.latestAt).toLocaleString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.data.items.length === 0 && <p>Групп по фильтрам нет.</p>}
          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => update('page', String(page - 1))}
            >
              Назад
            </button>
            <span>Страница {page}</span>
            <button
              disabled={page * state.data.limit >= state.data.total}
              onClick={() => update('page', String(page + 1))}
            >
              Далее
            </button>
          </div>
        </section>
      ) : (
        state.loading && <p>Загрузка групп…</p>
      )}
    </div>
  );
}
const actions = {
  RESOLVE_REPORT: 'Завершить выбранные',
  REJECT_REPORT: 'Отклонить выбранные',
  NO_VIOLATION: 'Нарушения нет',
};
export function ReportGroupDetailsPage() {
  const { id = '' } = useParams();
  return <GroupBoard key={id} id={id} />;
}
function GroupBoard({ id }: { id: string }) {
  const location = useLocation();
  const origin = (location.state as { from?: unknown } | null)?.from;
  const returnTo =
    typeof origin === 'string' &&
    /^\/admin\/report-groups(?:\?[^#]*)?$/.test(origin)
      ? origin
      : '/admin/report-groups';
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => operationsService.group(id, signal),
    [id, reload],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{
    ids: string[];
    action: GroupDecision['action'];
    key: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [publicReason, setPublicReason] = useState('');
  const publicReasonValid =
    !publicReason.trim() || publicReason.trim().length >= 10;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pending || busy || reason.trim().length < 10 || !publicReasonValid)
      return;
    setBusy(true);
    setError('');
    try {
      await operationsService.decide(id, {
        reportIds: pending.ids,
        action: pending.action,
        reason: reason.trim(),
        ...(publicReason.trim() ? { publicReason: publicReason.trim() } : {}),
        idempotencyKey: pending.key,
      });
      setPending(null);
      setReason('');
      setPublicReason('');
      setSelected([]);
      setReload((value) => value + 1);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setPending(null);
        setSelected([]);
        setError('Группа изменилась. Обновите её и выберите жалобы заново.');
      } else
        setError(
          failure instanceof Error ? failure.message : 'Решение не сохранено',
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Модерация"
        title="Жалобы на один объект"
        description="Без массовых блокировок или удаления контента. Новые жалобы не добавляются к подтверждаемому решению."
        actions={
          <Link className="button secondary" to={returnTo}>
            К группам
          </Link>
        }
      />
      <button
        className="button secondary"
        disabled={state.loading || busy}
        onClick={() => {
          setSelected([]);
          setPending(null);
          setReload((value) => value + 1);
        }}
      >
        Обновить группу
      </button>
      {(state.error || error) && <p role="alert">{state.error || error}</p>}
      {state.data && (
        <>
          <section className="card">
            <h2>
              {reportTargetLabel[state.data.group.targetType]} ·{' '}
              {state.data.group.count} жалоб
            </h2>
            {state.data.hasMore && (
              <p className="coverage-warning">
                Показаны 100 жалоб; сначала открытые. После решения обновите
                группу, чтобы разобрать остальные.
              </p>
            )}
            <details>
              <summary>Идентификатор объекта</summary>
              <code>{state.data.group.targetId}</code>
            </details>
            <div className="operations-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Выбрать</th>
                    <th>Жалоба</th>
                    <th>Статус</th>
                    <th>Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.reports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Выбрать жалобу ${report.id}`}
                          disabled={
                            busy ||
                            !!pending ||
                            !['OPEN', 'IN_REVIEW'].includes(report.status) ||
                            (selected.length >= 100 &&
                              !selected.includes(report.id))
                          }
                          checked={selected.includes(report.id)}
                          onChange={(event) =>
                            setSelected((previous) =>
                              event.target.checked
                                ? [...previous, report.id]
                                : previous.filter(
                                    (value) => value !== report.id,
                                  ),
                            )
                          }
                        />
                      </td>
                      <th>
                        <Link
                          to={`/admin/reports/${report.id}`}
                          state={{ from: `/admin/report-groups/${id}` }}
                        >
                          {report.id.slice(0, 8)}
                        </Link>
                      </th>
                      <td>{reportStatusLabel[report.status]}</td>
                      <td>{report.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Выбрано: {selected.length} / 100</p>
            <div className="operations-controls">
              {Object.entries(actions).map(([action, label]) => (
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || selected.length === 0}
                  key={action}
                  onClick={() => {
                    setPending({
                      ids: [...selected],
                      action: action as GroupDecision['action'],
                      key: crypto.randomUUID(),
                    });
                    setReason('');
                    setPublicReason('');
                    setError('');
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>Решения по группе</h2>
            {state.data.decisions.length === 0 ? (
              <p>Решений пока нет.</p>
            ) : (
              state.data.decisions.map((decision) => (
                <article key={decision.id}>
                  <h3>
                    {actions[decision.action]} · {decision.reportCount} жалоб
                  </h3>
                  <p>{decision.reason}</p>
                  <small>
                    {decision.actor.name} ·{' '}
                    {new Date(decision.createdAt).toLocaleString('ru-RU')}
                  </small>
                </article>
              ))
            )}
          </section>
        </>
      )}
      <Dialog
        open={!!pending}
        title="Подтвердить решение по выбранным жалобам"
        dismissDisabled={busy}
        onClose={() => {
          if (!busy) setPending(null);
        }}
      >
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <p>
            {pending && actions[pending.action]} · {pending?.ids.length} жалоб.
            Санкции и содержимое этим действием не изменяются.
          </p>
          <details>
            <summary>Точный список выбранных жалоб</summary>
            {pending?.ids.map((value) => (
              <code key={value} style={{ display: 'block' }}>
                {value}
              </code>
            ))}
          </details>
          <label>
            Основание решения
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Объяснение пользователю
            <textarea
              minLength={10}
              maxLength={1000}
              value={publicReason}
              onChange={(event) => setPublicReason(event.target.value)}
              disabled={busy}
              aria-describedby="group-public-reason-help"
            />
          </label>
          <p id="group-public-reason-help" className="data-note">
            Необязательно · {publicReason.length} / 1000 символов. Если
            заполнено, минимум 10 символов. Это объяснение увидит пользователь;
            внутреннее основание решения в него не подставляется.
          </p>
          {error && pending && <p role="alert">{error}</p>}
          <button
            className="button primary"
            disabled={busy || reason.trim().length < 10 || !publicReasonValid}
          >
            {busy ? 'Применение…' : 'Подтвердить решение'}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
