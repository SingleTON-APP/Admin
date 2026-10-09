import { useEffect, useState, type FormEvent } from 'react';
import { useAsync } from '../hooks/useAsync';
import { useAdminLogout } from '../features/admin-access/LogoutContext';
import {
  operationsService,
  type StaffSession,
  type StaffSecurity,
} from '../services/operations-v2.service';
import { Dialog } from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/Primitives';
import '../styles/operations-v2.css';

export function AccessSecurityPage() {
  const logout = useAdminLogout();
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => operationsService.sessions(signal),
    [reload],
  );
  const [selected, setSelected] = useState<StaffSession | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savingCodes, setSavingCodes] = useState(false);
  const revoke = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || busy || reason.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      await operationsService.revokeSession(selected.id, reason.trim());
      const current = selected.current;
      setSelected(null);
      setReason('');
      if (current) await logout(true);
      else setReload((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось завершить сессию',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Личный доступ"
        title="Сессии и двухфакторная защита"
        description="Это доступ сотрудника к админке. Сессии обычного аккаунта Hub управляются отдельно."
      />
      <button
        className="button secondary"
        disabled={state.loading || busy || savingCodes}
        onClick={() => setReload((value) => value + 1)}
      >
        Обновить мои сессии
      </button>
      {(state.error || error) && <p role="alert">{state.error || error}</p>}
      {state.data ? (
        <>
          <TotpSettings
            key={`${state.data.totpEnabled}:${reload}`}
            security={state.data}
            onChanged={() => setReload((value) => value + 1)}
            onRecoveryPending={setSavingCodes}
          />
          <section className="card">
            <h2>Мои сессии админки</h2>
            <p className="data-note">
              Показаны только ваши входы. IP и устройство помогают распознать
              доступ; сведения о браузере переданы самим клиентом.
            </p>
            <div className="operations-grid">
              {state.data.items.map((session) => (
                <article
                  className={`card ${session.current ? 'session-current' : ''}`}
                  key={session.id}
                >
                  <h3>
                    {session.current ? 'Текущая сессия' : 'Другая сессия'}
                  </h3>
                  <p>
                    {session.username} · {session.ip}
                  </p>
                  <p className="preserve-lines">
                    {session.userAgent || 'Устройство неизвестно'}
                  </p>
                  <p>
                    Вход: {new Date(session.createdAt).toLocaleString('ru-RU')}
                    <br />
                    Активность:{' '}
                    {new Date(session.lastSeenAt).toLocaleString('ru-RU')}
                    <br />
                    Истекает:{' '}
                    {new Date(session.expiresAt).toLocaleString('ru-RU')}
                  </p>
                  <button
                    className="button danger"
                    disabled={busy || savingCodes}
                    onClick={() => {
                      setSelected(session);
                      setReason('');
                      setError('');
                    }}
                  >
                    Завершить {session.current ? 'текущую сессию' : 'сессию'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        state.loading && <p>Загрузка сессий…</p>
      )}
      <Dialog
        open={!!selected}
        title="Завершить сессию админки"
        dismissDisabled={busy}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <form className="form-stack" onSubmit={(event) => void revoke(event)}>
          <p>
            {selected?.current
              ? 'Вы выйдете из админки на этом устройстве.'
              : 'Выбранное устройство потеряет доступ к админке.'}
          </p>
          <p>
            {selected?.ip} · {selected?.userAgent}
          </p>
          <label>
            Основание
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            className="button danger"
            disabled={busy || reason.trim().length < 10}
          >
            {busy ? 'Завершение…' : 'Подтвердить завершение'}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
function TotpSettings({
  security,
  onChanged,
  onRecoveryPending,
}: {
  security: StaffSecurity;
  onChanged: () => void;
  onRecoveryPending: (pending: boolean) => void;
}) {
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  useEffect(() => {
    if (!recoveryCodes) return;
    const beforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeLeave);
    return () => window.removeEventListener('beforeunload', beforeLeave);
  }, [recoveryCodes]);
  const run = async (
    event: FormEvent,
    action: 'setup' | 'confirm' | 'disable',
  ) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'setup') {
        setSetup(await operationsService.setupTotp(password));
        setPassword('');
      } else {
        if (action === 'confirm') {
          const result = await operationsService.confirmTotp(code);
          setRecoveryCodes(result.recoveryCodes);
          onRecoveryPending(true);
        } else await operationsService.disableTotp(password, code);
        setSetup(null);
        setCode('');
        setPassword('');
        if (action !== 'confirm') onChanged();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось изменить защиту',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2>Коды приложения-аутентификатора</h2>
      <p>
        {security.totpEnabled || recoveryCodes
          ? 'Двухфакторная защита включена для вашей учётной записи сотрудника.'
          : 'Двухфакторная защита выключена. Она включится только после подтверждения кода.'}
      </p>
      {recoveryCodes ? (
        <section aria-label="Резервные коды двухфакторной защиты">
          <h3>Сохраните резервные коды</h3>
          <p>
            Эти одноразовые коды показаны только сейчас. Они позволят войти при
            потере телефона. Сохраните их в защищённом месте перед выходом со
            страницы.
          </p>
          {recoveryCodes.map((value) => (
            <code className="secret-value" key={value}>
              {value}
            </code>
          ))}
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setRecoveryCodes(null);
              onRecoveryPending(false);
              onChanged();
            }}
          >
            Я сохранил резервные коды
          </button>
        </section>
      ) : !security.totpConfigured ? (
        <p>
          Настройка недоступна: серверный ключ шифрования ещё не настроен.
          Обратитесь к администратору.
        </p>
      ) : setup ? (
        <form
          className="form-stack"
          onSubmit={(event) => void run(event, 'confirm')}
        >
          <p>
            Добавьте секрет вручную в приложение-аутентификатор. Секрет показан
            только здесь; не пересылайте его и не сохраняйте в общих заметках.
            Настройку нужно подтвердить в течение 10 минут.
          </p>
          <code className="secret-value">{setup.secret}</code>
          <details>
            <summary>Ссылка для приложения-аутентификатора</summary>
            <code className="secret-value">{setup.otpauthUrl}</code>
          </details>
          <label>
            Код из приложения
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={6}
              disabled={busy}
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !/^\d{6}$/.test(code)}
          >
            Подтвердить и включить
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              setSetup(null);
              setCode('');
            }}
          >
            Отменить настройку
          </button>
        </form>
      ) : (
        <form
          className="form-stack"
          onSubmit={(event) =>
            void run(event, security.totpEnabled ? 'disable' : 'setup')
          }
        >
          <label>
            Личный пароль сотрудника
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </label>
          {security.totpEnabled && (
            <label>
              Текущий код
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={6}
                disabled={busy}
              />
            </label>
          )}
          <button
            className={`button ${security.totpEnabled ? 'danger' : 'primary'}`}
            disabled={
              busy ||
              !password ||
              (security.totpEnabled && !/^\d{6}$/.test(code))
            }
          >
            {security.totpEnabled
              ? 'Отключить двухфакторную защиту'
              : 'Настроить двухфакторную защиту'}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
