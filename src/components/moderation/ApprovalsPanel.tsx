import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { operationsV3Service } from '../../services/operations-v3.service';

const sensitiveActionLabels = {
  PERMANENT_BAN_USER: 'Постоянная блокировка',
  DELETE_USER: 'Удаление аккаунта',
  REVOKE_ALL_SESSIONS: 'Завершение всех сессий',
};
const proposalStatusLabels = {
  PENDING: 'Ожидает согласования',
  APPROVED: 'Согласовано',
  EXECUTING: 'Выполняется',
  EXECUTED: 'Выполнено',
  REJECTED: 'Отклонено',
  EXPIRED: 'Истекло',
  STALE: 'Цель изменилась',
  NEEDS_RECONCILIATION: 'Нужна ручная сверка',
};
export function ApprovalsPanel() {
  const [params, setParams] = useSearchParams();
  const id = params.get('proposal') || '';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => operationsV3Service.proposals(page, status, signal),
    [page, status, reload],
  );
  return (
    <section className="card operation-card">
      <h2>Независимое согласование действий</h2>
      <p className="data-note">
        Создатель заявки и её цель не могут согласовать действие. Выполняет
        создатель после согласования; цель и ревизия фиксируются сервером. Срок
        заявки — 30 минут. Неопределённый результат требует ручной сверки,
        автоматического повтора нет.
      </p>
      <div className="operations-toolbar">
        <label>
          Состояние заявки
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            {Object.entries(proposalStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={state.loading}
          onClick={() => setReload((x) => x + 1)}
        >
          Обновить заявки
        </button>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {id && (
        <ProposalEditor
          key={id}
          id={id}
          onChanged={() => setReload((x) => x + 1)}
        />
      )}
      {state.data && (
        <>
          <div className="operations-grid">
            {state.data.items.map((item) => (
              <article className="card operation-card" key={item.id}>
                <h3>{sensitiveActionLabels[item.action]}</h3>
                <p>
                  {item.target.name} · {item.target.publicId}
                </p>
                <p>{proposalStatusLabels[item.status]}</p>
                <p>
                  Автор: {item.creator.name} · согласовал:{' '}
                  {item.approver?.name || 'Пока никто'}
                </p>
                <Link
                  className="button secondary"
                  to={`/admin/operations?tab=approvals&proposal=${encodeURIComponent(item.id)}`}
                >
                  Открыть заявку
                </Link>
              </article>
            ))}
          </div>
          {!state.data.items.length && <p>Заявок нет.</p>}
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((x) => x - 1)}>
              Предыдущие заявки
            </button>
            <span>Страница {page}</span>
            <button
              disabled={page * state.data.limit >= state.data.total}
              onClick={() => setPage((x) => x + 1)}
            >
              Следующие заявки
            </button>
          </div>
        </>
      )}
      {id && (
        <button
          className="button secondary"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete('proposal');
            setParams(next);
          }}
        >
          Закрыть карточку заявки
        </button>
      )}
    </section>
  );
}
function ProposalEditor({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => operationsV3Service.proposal(id, signal),
    [id, reload],
  );
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function review(event: FormEvent) {
    event.preventDefault();
    if (!state.data?.canApprove || busy || reason.trim().length < 10) return;
    await run(() =>
      operationsV3Service.reviewProposal(
        id,
        decision,
        state.data!.revision,
        reason.trim(),
      ),
    );
  }
  async function run(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setReason('');
      setReload((x) => x + 1);
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Действие не выполнено.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card operation-card">
      <h3>Карточка заявки</h3>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data && (
        <>
          <h4>
            {sensitiveActionLabels[state.data.action]} ·{' '}
            {state.data.target.name}
          </h4>
          <p>
            {proposalStatusLabels[state.data.status]} · ревизия{' '}
            {state.data.revision}
          </p>
          <p className="operation-reason">{state.data.reason}</p>
          <p>
            Создал {state.data.creator.name}; согласовал{' '}
            {state.data.approver?.name || 'Никто'}. Истекает{' '}
            {new Date(state.data.expiresAt).toLocaleString('ru-RU')}
          </p>
          {state.data.reportId && (
            <Link to={`/admin/reports/${state.data.reportId}`}>
              Исходная жалоба
            </Link>
          )}
          {state.data.status === 'NEEDS_RECONCILIATION' && (
            <p className="coverage-warning">
              Внешний результат не подтверждён. Сначала вручную проверьте
              фактическое состояние и аудит; повтор автоматически запрещён.
            </p>
          )}
          {state.data.canApprove ? (
            <form
              className="form-stack"
              onSubmit={(event) => void review(event)}
            >
              <label>
                Результат согласования
                <select
                  value={decision}
                  onChange={(event) =>
                    setDecision(event.target.value as typeof decision)
                  }
                  disabled={busy}
                >
                  <option value="APPROVE">Согласовать</option>
                  <option value="REJECT">Отклонить</option>
                </select>
              </label>
              <label>
                Основание независимой проверки
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  required
                  disabled={busy}
                />
              </label>
              <button
                className="button primary"
                disabled={busy || reason.trim().length < 10}
              >
                Сохранить согласование
              </button>
            </form>
          ) : (
            <p className="data-note">
              Независимое согласование для вас сейчас недоступно. Создатель и
              цель заявки не могут её согласовать.
            </p>
          )}
          {state.data.canExecute && (
            <button
              className="button danger"
              disabled={busy || Date.parse(state.data.expiresAt) <= Date.now()}
              onClick={() => {
                if (state.data?.canExecute)
                  void run(() =>
                    operationsV3Service.executeProposal(
                      id,
                      state.data!.revision,
                    ),
                  );
              }}
            >
              Выполнить согласованное действие
            </button>
          )}
          <button
            className="button secondary"
            disabled={busy || state.loading}
            onClick={() => setReload((x) => x + 1)}
          >
            Обновить карточку заявки
          </button>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </article>
  );
}
