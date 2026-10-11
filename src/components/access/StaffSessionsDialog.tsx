import { useState, type FormEvent } from 'react';
import { useAsync } from '../../hooks/useAsync';
import {
  adminAuthService,
  type AdminAccount,
  type AdminStaffSession,
} from '../../services/admin-auth.service';
import { Dialog } from '../ui/Dialog';
import '../../styles/staff-access.css';

export function StaffSessionsDialog({
  account,
  onClose,
  onChanged,
}: {
  account: AdminAccount;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => adminAuthService.staffSessions(account.id, signal),
    [account.id, reload],
  );
  const [target, setTarget] = useState<AdminStaffSession | 'ALL' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (!target || busy || reason.trim().length < 10) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminAuthService.revokeStaffSessions(
        account.id,
        reason.trim(),
        target === 'ALL' ? undefined : target.id,
      );
      setTarget(null);
      setReason('');
      setNotice('Доступ выбранных сессий отозван. Действие записано в аудит.');
      setReload((value) => value + 1);
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось завершить сессии',
      );
    } finally {
      setBusy(false);
    }
  }
  function confirm(value: AdminStaffSession | 'ALL') {
    setTarget(value);
    setError('');
    setNotice('');
    setReason('');
  }
  return (
    <Dialog
      open
      title={`Сессии сотрудника ${account.username}`}
      dismissDisabled={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {target ? (
        <form className="form-stack" onSubmit={(event) => void revoke(event)}>
          <p>
            {target === 'ALL'
              ? 'Все устройства сотрудника потеряют доступ к админке.'
              : `Доступ этого устройства будет отозван: ${target.ip} · ${target.userAgent || 'Браузер неизвестен'}`}
          </p>
          <p className="muted">
            Новый вход останется доступен. Чтобы запретить его, отключите
            учётную запись сотрудника.
          </p>
          <label>
            Причина завершения
            <textarea
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={10}
              maxLength={1000}
              disabled={busy}
            />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setTarget(null);
                setError('');
              }}
            >
              Назад
            </button>
            <button
              className="button danger"
              disabled={busy || reason.trim().length < 10}
            >
              {busy
                ? 'Завершаем…'
                : target === 'ALL'
                  ? 'Подтвердить завершение всех сессий'
                  : 'Подтвердить завершение сессии'}
            </button>
          </div>
        </form>
      ) : (
        <div className="form-stack">
          <p className="muted">
            Активные входы в админку. IP и сведения о браузере помогают
            распознать устройство; сведения о браузере переданы клиентом.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              disabled={state.loading}
              onClick={() => setReload((value) => value + 1)}
            >
              Обновить сессии
            </button>
            <button
              type="button"
              className="button danger"
              disabled={state.loading || !state.data?.items.length}
              onClick={() => confirm('ALL')}
            >
              Завершить все сессии
            </button>
          </div>
          {state.loading ? (
            <p role="status">Загрузка сессий…</p>
          ) : state.error ? (
            <p role="alert">{state.error}</p>
          ) : state.data?.items.length ? (
            <div className="staff-session-list">
              {state.data.items.map((session) => (
                <article key={session.id}>
                  <strong>{session.ip || 'IP неизвестен'}</strong>
                  <p>{session.userAgent || 'Браузер неизвестен'}</p>
                  <p className="muted">
                    Вход: {new Date(session.createdAt).toLocaleString('ru-RU')}
                    <br />
                    Активность:{' '}
                    {new Date(session.lastSeenAt).toLocaleString('ru-RU')}
                    <br />
                    Истекает:{' '}
                    {new Date(session.expiresAt).toLocaleString('ru-RU')}
                  </p>
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => confirm(session)}
                  >
                    Завершить сессию
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>Активных сессий нет.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
