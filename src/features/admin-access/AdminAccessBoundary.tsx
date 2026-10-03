import { LogoutContext } from './LogoutContext';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ADMIN_ACCESS_EXPIRED, setAdminCsrf } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/ui/Primitives';
import {
  adminAuthService,
  type AdminSession,
} from '../../services/admin-auth.service';
import { AdminContext } from './AdminContext';
export function AdminAccessBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  async function load() {
    setLoading(true);
    setFailure('');
    try {
      setSession(await adminAuthService.session());
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Не удалось проверить доступ',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let disposed = false;
    adminAuthService
      .session()
      .then((value) => {
        if (!disposed) setSession(value);
      })
      .catch((error) => {
        if (!disposed)
          setFailure(
            error instanceof Error
              ? error.message
              : 'Не удалось проверить доступ',
          );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    const expired = () => {
      setSession(null);
      setAdminCsrf('');
      setFailure('Сессия истекла. Войдите заново.');
      void load();
    };
    window.addEventListener(ADMIN_ACCESS_EXPIRED, expired);
    return () => {
      disposed = true;
      window.removeEventListener(ADMIN_ACCESS_EXPIRED, expired);
    };
  }, []);
  async function logout(serverRevoked = false) {
    // Clear all private React state immediately, even if the network is unavailable.
    setSession(null);
    setLoading(true);
    try {
      if (!serverRevoked) await adminAuthService.logout();
      setAdminCsrf('');
      setLogoutFailed(false);
      await load();
    } catch {
      setFailure('Не удалось завершить сессию на сервере. Повторите выход.');
      setLogoutFailed(true);
      setLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setFailure('');
    try {
      const value = session?.gateAuthenticated
        ? await adminAuthService.login(
            String(fields.get('username')),
            String(fields.get('password')),
          )
        : await adminAuthService.gate(String(fields.get('password')));
      form.reset();
      setSession(value);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Доступ не подтверждён',
      );
      form.querySelector<HTMLInputElement>('input[type=password]')?.select();
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="access-screen">
        <LoadingState />
      </main>
    );
  if (session?.actor && session.gateAuthenticated)
    return (
      <AdminContext.Provider value={session.actor}>
        <LogoutContext.Provider value={logout}>
          {children}
        </LogoutContext.Provider>
      </AdminContext.Provider>
    );
  if (!session)
    return (
      <main className="access-screen">
        <ErrorState message={failure || 'Доступ не подтверждён'} />
        <button
          className="button secondary"
          onClick={() => void (logoutFailed ? logout() : load())}
        >
          Повторить
        </button>
      </main>
    );
  return (
    <main className="access-screen">
      <section className="card access-card">
        <small>SingleTON · защищённый доступ</small>
        <h1>
          {session.gateAuthenticated ? 'Вход сотрудника' : 'Доступ к админке'}
        </h1>
        <p>
          {session.gateAuthenticated
            ? 'Используйте учётную запись, созданную корневым администратором.'
            : 'Введите общий пароль. Затем потребуется личная учётная запись.'}
        </p>
        <form
          key={String(session.gateAuthenticated)}
          className="form-stack"
          onSubmit={submit}
        >
          {session.gateAuthenticated && (
            <label>
              Логин
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={64}
              />
            </label>
          )}
          <label>
            {session.gateAuthenticated ? 'Пароль сотрудника' : 'Общий пароль'}
            <input
              name="password"
              type="password"
              autoComplete={
                session.gateAuthenticated ? 'current-password' : 'off'
              }
              required
              maxLength={256}
            />
          </label>
          {failure && (
            <p className="state-error" role="alert">
              {failure}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Проверка…' : 'Продолжить'}
          </button>
          <small>После 5 неверных попыток вход с IP блокируется на час.</small>
        </form>
      </section>
    </main>
  );
}
