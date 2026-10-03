import { useState, type FormEvent } from 'react';
import { ErrorState, PageHeader } from '../components/ui/Primitives';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAdminLogout } from '../features/admin-access/LogoutContext';
import { adminAuthService } from '../services/admin-auth.service';
export function SecurityPage() {
  const admin = useAdmin();
  const logout = useAdminLogout();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (fields.get('password') !== fields.get('confirm')) {
      setFailure('Пароли не совпадают');
      return;
    }
    setBusy(true);
    setFailure('');
    try {
      await adminAuthService.sharedPassword(String(fields.get('password')));
      form.reset();
      await logout(true);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Не удалось изменить пароль',
      );
    } finally {
      setBusy(false);
    }
  }
  if (admin.role !== 'FULL_ADMIN')
    return (
      <ErrorState message="Настройки безопасности доступны только корневому администратору." />
    );
  return (
    <>
      <PageHeader
        eyebrow="Доступ"
        title="Безопасность админки"
        description="Два этапа входа: общий пароль и личная учётная запись."
      />
      <section className="card">
        <h2>Сменить общий пароль</h2>
        <p>
          После смены все сессии админки будут завершены. Передайте новый пароль
          сотрудникам безопасным способом.
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Новый общий пароль
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={16}
              maxLength={72}
            />
          </label>
          <label>
            Повторите пароль
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={16}
              maxLength={72}
            />
          </label>
          <label>
            <input name="confirmed" type="checkbox" required /> Подтверждаю
            завершение всех сессий
          </label>
          {failure && (
            <p className="state-error" role="alert">
              {failure}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Сохранение…' : 'Сменить пароль и завершить сессии'}
          </button>
        </form>
      </section>
    </>
  );
}
