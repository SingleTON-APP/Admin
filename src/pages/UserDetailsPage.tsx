import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Dialog } from '../components/ui/Dialog';
import {
  Avatar,
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';

type Action = 'TEMPORARY' | 'PERMANENT' | 'UNBAN' | 'DELETE' | 'REVOKE_ALL';

export function UserDetailsPage() {
  const { id = '' } = useParams();
  const admin = useAdmin();
  const [reload, setReload] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const state = useAsync(
    (signal) => adminService.user(id, signal),
    [id, reload],
  );
  if (state.loading) return <LoadingState />;
  if (state.error || !state.data)
    return <ErrorState message={state.error ?? 'Пользователь не найден'} />;
  const user = state.data;
  const canManage = user.role !== 'FULL_ADMIN' && user.id !== admin.id;
  const canAdmin = admin.role !== 'MODERATOR';
  const name = `${user.firstName} ${user.lastName}`.trim() || user.username;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') ?? '');
    const days = Number(form.get('days'));
    setBusy(true);
    setFailure('');
    try {
      if (action === 'TEMPORARY')
        await adminService.sanction(user.id, {
          type: action,
          durationDays: days,
          reason,
        });
      if (action === 'PERMANENT')
        await adminService.sanction(user.id, { type: action, reason });
      if (action === 'UNBAN') await adminService.unban(user.id, reason);
      if (action === 'DELETE') await adminService.deleteUser(user.id, reason);
      if (action === 'REVOKE_ALL')
        await adminService.revokeAllSessions(user.id, reason);
      setAction(null);
      setReload((value) => value + 1);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'Не удалось выполнить действие',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`@${user.username}`}
        title={name}
        description={`Создан ${new Date(user.createdAt).toLocaleString('ru-RU')}`}
        actions={
          <Link className="button secondary" to="/admin/users">
            К списку
          </Link>
        }
      />
      <div className="detail-title profile-heading">
        <Avatar name={name} size="lg" />
        <div>
          <StatusBadge value={user.status} /> <strong>{user.role}</strong>
          <p>
            <IDDisplay value={user.publicId} />
          </p>
        </div>
      </div>
      <div className="detail-stats">
        <article className="stat-card">
          <span>Жалобы</span>
          <strong>{user.reportCount}</strong>
        </article>
        <article className="stat-card">
          <span>Сессии</span>
          <strong>{user.sessions.length}</strong>
        </article>
        <article className="stat-card">
          <span>Последняя активность</span>
          <strong>
            {user.lastSeen
              ? new Date(user.lastSeen).toLocaleDateString('ru-RU')
              : '—'}
          </strong>
        </article>
        <article className="stat-card">
          <span>Активная санкция</span>
          <strong>
            {user.sanctions.some((item) => item.status === 'ACTIVE')
              ? 'Да'
              : 'Нет'}
          </strong>
        </article>
      </div>
      <div className="two-column">
        <section className="card">
          <div className="card-head">
            <h2>Данные аккаунта</h2>
          </div>
          <dl className="details-list">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Внутренний ID</dt>
              <dd>
                <IDDisplay value={user.id} />
              </dd>
            </div>
            <div>
              <dt>Состояние</dt>
              <dd>{user.isActivated ? 'Активирован' : 'Отключён'}</dd>
            </div>
          </dl>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>История санкций</h2>
          </div>
          {user.sanctions.length ? (
            <div className="timeline">
              {user.sanctions.map((item) => (
                <div key={item.id}>
                  <i />
                  <span>
                    <strong>
                      {item.type} · {item.status}
                    </strong>
                    <small>
                      {item.reason} ·{' '}
                      {new Date(item.createdAt).toLocaleString('ru-RU')}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="data-note">Санкций нет.</p>
          )}
        </section>
      </div>
      <section className="card incidents">
        <div className="card-head">
          <h2>История модерации</h2>
        </div>
        {user.moderationHistory.length ? (
          user.moderationHistory.map((event) => (
            <div key={event.id}>
              <StatusBadge value={event.result} />
              <span>
                <strong>{event.action}</strong>
                <small>
                  {event.staff?.name || 'Система'} ·{' '}
                  {event.reason || 'Без комментария'}
                </small>
              </span>
              <span className="incident-date">
                {new Date(event.timestamp).toLocaleString('ru-RU')}
              </span>
            </div>
          ))
        ) : (
          <p className="data-note">Действий модерации нет.</p>
        )}
      </section>
      <section className="card incidents">
        <div className="card-head">
          <h2>Активные сессии</h2>
          {canAdmin && user.sessions.length > 0 && (
            <button
              className="button secondary"
              onClick={() => setAction('REVOKE_ALL')}
            >
              Завершить все
            </button>
          )}
        </div>
        {user.sessions.map((session) => (
          <div key={session.id}>
            <IDDisplay value={session.id} />
            <span>
              <strong>
                {session.device.browser} · {session.device.os}
                {session.current ? ' · текущая' : ''}
              </strong>
              <small>
                {session.ip} · {session.location} · активность{' '}
                {new Date(session.lastSeen).toLocaleString('ru-RU')}
              </small>
            </span>
            {canAdmin && (
              <button
                className="button secondary"
                onClick={async () => {
                  const reason = window.prompt('Причина завершения сессии');
                  if (!reason) return;
                  await adminService.revokeSession(user.id, session.id, reason);
                  setReload((value) => value + 1);
                }}
              >
                Завершить
              </button>
            )}
          </div>
        ))}
      </section>
      {canManage && (
        <section className="danger-zone">
          <div>
            <h2>Действия модерации</h2>
            <p>Все действия требуют причины и записываются в журнал.</p>
          </div>
          <div className="page-actions">
            <button
              className="button secondary"
              onClick={() => setAction('TEMPORARY')}
            >
              Временная блокировка
            </button>
            {canAdmin && (
              <>
                <button
                  className="button danger"
                  onClick={() =>
                    setAction(
                      user.status === 'BANNED' || user.status === 'SUSPENDED'
                        ? 'UNBAN'
                        : 'PERMANENT',
                    )
                  }
                >
                  {user.status === 'BANNED' || user.status === 'SUSPENDED'
                    ? 'Снять блокировку'
                    : 'Заблокировать навсегда'}
                </button>
                {user.role === 'USER' && (
                  <button
                    className="button danger"
                    onClick={() => setAction('DELETE')}
                  >
                    Удалить аккаунт
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}
      <Dialog
        open={action !== null}
        title="Подтверждение действия"
        onClose={() => setAction(null)}
      >
        <form className="form-stack" onSubmit={submit}>
          {action === 'TEMPORARY' && (
            <label>
              Срок, дней
              <input
                name="days"
                type="number"
                min="1"
                max="365"
                defaultValue="7"
                required
              />
            </label>
          )}
          <label>
            Причина
            <textarea name="reason" maxLength={1000} required />
          </label>
          {failure && <p className="state-error">{failure}</p>}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setAction(null)}
            >
              Отмена
            </button>
            <button className="button danger" disabled={busy}>
              {busy ? 'Выполняется…' : 'Подтвердить'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
