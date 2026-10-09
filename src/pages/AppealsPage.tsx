import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import { operationsService } from '../services/operations-v2.service';
import { PageHeader } from '../components/ui/Primitives';
import '../styles/operations-v2.css';
const statuses = {
  OPEN: 'Ожидает проверки',
  UPHELD: 'Исходное решение подтверждено',
  REVIEW_REQUIRED: 'Нужна повторная проверка',
};
export function AppealsPage() {
  const admin = useAdmin();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') || '';
  const allowed = admin.role !== 'MODERATOR';
  const state = useAsync(
    (signal) =>
      allowed
        ? operationsService.appeals(page, status, signal)
        : Promise.resolve(undefined),
    [page, status, allowed],
  );
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Независимая проверка"
        title="Апелляции"
        description="Апелляцию рассматривает другой администратор. Повторная проверка не отменяет санкции автоматически."
      />
      {!allowed ? (
        <p role="alert">Доступно ADMIN и FULL_ADMIN.</p>
      ) : (
        <>
          <label>
            Статус{' '}
            <select
              value={status}
              onChange={(event) =>
                setParams(
                  event.target.value ? { status: event.target.value } : {},
                )
              }
            >
              <option value="">Все статусы</option>
              {Object.entries(statuses).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {state.error && <p role="alert">{state.error}</p>}
          {state.data ? (
            <section className="card">
              <div className="operations-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Апелляция</th>
                      <th>Заявитель</th>
                      <th>Статус</th>
                      <th>Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((item) => (
                      <tr key={item.id}>
                        <th>
                          <Link to={`/admin/appeals/${item.id}`}>
                            {new Date(item.createdAt).toLocaleString('ru-RU')}
                          </Link>
                        </th>
                        <td>
                          {item.appellant.name} ·{' '}
                          {item.party === 'REPORTER'
                            ? 'Заявитель жалобы'
                            : 'Субъект решения'}
                        </td>
                        <td>{statuses[item.status]}</td>
                        <td>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data.items.length === 0 && <p>Апелляций пока нет.</p>}
              <div className="pagination">
                <button
                  disabled={page <= 1}
                  onClick={() =>
                    setParams({
                      ...(status ? { status } : {}),
                      page: String(page - 1),
                    })
                  }
                >
                  Назад
                </button>
                <span>Страница {page}</span>
                <button
                  disabled={page * state.data.limit >= state.data.total}
                  onClick={() =>
                    setParams({
                      ...(status ? { status } : {}),
                      page: String(page + 1),
                    })
                  }
                >
                  Далее
                </button>
              </div>
            </section>
          ) : (
            state.loading && <p>Загрузка апелляций…</p>
          )}
        </>
      )}
    </div>
  );
}
export function AppealDetailsPage() {
  const { id = '' } = useParams();
  return <AppealBoard key={id} id={id} />;
}
function AppealBoard({ id }: { id: string }) {
  const admin = useAdmin();
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) =>
      admin.role === 'MODERATOR'
        ? Promise.resolve(undefined)
        : operationsService.appeal(id, signal),
    [id, admin.role, reload],
  );
  const [outcome, setOutcome] = useState<'UPHELD' | 'REVIEW_REQUIRED'>(
    'UPHELD',
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!state.data?.canReview || busy || reason.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      await operationsService.review(id, outcome, reason.trim());
      setReason('');
      setReload((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось сохранить проверку',
      );
    } finally {
      setBusy(false);
    }
  };
  const appeal = state.data;
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Независимая проверка"
        title="Апелляция на решение"
        description="Даже FULL_ADMIN не рассматривает апелляцию на собственное решение."
        actions={
          <Link className="button secondary" to="/admin/appeals">
            К апелляциям
          </Link>
        }
      />
      {(state.error || error) && <p role="alert">{state.error || error}</p>}
      {admin.role === 'MODERATOR' && (
        <p role="alert">Доступно ADMIN и FULL_ADMIN.</p>
      )}
      {appeal && (
        <>
          <section className="card">
            <h2>{statuses[appeal.status]}</h2>
            <p className="preserve-lines">{appeal.reason}</p>
            <p>
              {appeal.appellant.name} ·{' '}
              {new Date(appeal.createdAt).toLocaleString('ru-RU')}
            </p>
            <h3>Исходное решение</h3>
            <p>{appeal.decision.reason}</p>
            <p>
              {appeal.decision.actor?.name || 'Автор решения неизвестен'} ·{' '}
              {appeal.source === 'SANCTION'
                ? 'Действующая санкция'
                : `${appeal.decision.reportCount} жалоб`}
            </p>
            {appeal.reviewReason && (
              <p>
                <strong>Результат проверки:</strong> {appeal.reviewReason}
              </p>
            )}
          </section>
          {appeal.canReview ? (
            <form
              className="card form-stack"
              onSubmit={(event) => void submit(event)}
            >
              <label>
                Результат
                <select
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(event.target.value as typeof outcome)
                  }
                  disabled={busy}
                >
                  <option value="UPHELD">Подтвердить исходное решение</option>
                  <option value="REVIEW_REQUIRED">
                    Передать на повторную проверку
                  </option>
                </select>
              </label>
              <p>
                Этот результат не снимает санкции и не открывает жалобы
                автоматически.
              </p>
              <label>
                Обоснование
                <textarea
                  minLength={10}
                  maxLength={2000}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                />
              </label>
              <button
                className="button primary"
                disabled={busy || reason.trim().length < 10}
              >
                {busy ? 'Сохранение…' : 'Сохранить результат проверки'}
              </button>
            </form>
          ) : (
            <p className="coverage-warning">
              {appeal.decision.actor.id == null
                ? 'Автор исходного решения неизвестен. Независимый пересмотр недоступен; требуется ручная проверка.'
                : 'Проверка недоступна: апелляция уже рассмотрена либо исходное решение принадлежит вам. Требуется другой администратор.'}
            </p>
          )}
          <section className="card">
            <h2>История апелляции</h2>
            {appeal.history?.length ? (
              appeal.history.map((item, index) => (
                <article key={`${item.createdAt}-${index}`}>
                  <p>{item.reason}</p>
                  <small>
                    {item.actor.name} ·{' '}
                    {new Date(item.createdAt).toLocaleString('ru-RU')}
                  </small>
                </article>
              ))
            ) : (
              <p>Дополнительных событий пока нет.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
