import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { DataTable, type Column } from '../components/ui/DataTable';
import {
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import {
  adminAuthService,
  type AdminAccount,
} from '../services/admin-auth.service';
import type { StaffRole } from '../types/domain';
export function StaffPage() {
  const admin = useAdmin();
  if (admin.role !== 'FULL_ADMIN')
    return (
      <ErrorState message="Управление учётными записями доступно только корневому администратору." />
    );
  return <StaffManagement actorId={admin.id} />;
}
function StaffManagement({ actorId }: { actorId: string }) {
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<AdminAccount | 'new' | null>(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const state = useAsync((signal) => adminAuthService.staff(signal), [reload]);
  const account = selected && selected !== 'new' ? selected : null;
  const columns: Column<AdminAccount>[] = [
    {
      key: 'username',
      header: 'Логин',
      render: (row) => <strong>{row.username}</strong>,
    },
    {
      key: 'userId',
      header: 'Пользователь',
      render: (row) => <IDDisplay value={row.userId} />,
    },
    {
      key: 'role',
      header: 'Роль',
      render: (row) => <StatusBadge value={row.role} />,
    },
    {
      key: 'status',
      header: 'Доступ',
      render: (row) => (
        <StatusBadge value={row.disabled ? 'DISABLED' : 'ACTIVE'} />
      ),
    },
    {
      key: 'totp',
      header: 'Двухфакторная защита',
      render: (row) => (
        <span>
          {row.totpEnabled ? 'Включена' : 'Выключена'}{' '}
          {row.totpEnabled && row.userId !== actorId && (
            <button
              className="button secondary"
              onClick={() => {
                setFailure('');
                setResetTarget(row);
              }}
            >
              Сбросить 2FA
            </button>
          )}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <button
          className="button secondary"
          onClick={() => {
            setFailure('');
            setSelected(row);
          }}
        >
          Настроить
        </button>
      ),
    },
  ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setFailure('');
    try {
      const role = String(fields.get('role')) as StaffRole;
      const password = String(fields.get('password') || '');
      if (selected === 'new')
        await adminAuthService.create({
          username: String(fields.get('username')),
          ...(fields.get('userId')
            ? { userId: String(fields.get('userId')) }
            : {}),
          name: String(fields.get('name') || ''),
          email: String(fields.get('email') || ''),
          role,
          password,
        });
      else
        await adminAuthService.update(selected.id, {
          role,
          disabled: fields.get('disabled') === 'on',
          ...(password ? { password } : {}),
        });
      setSelected(null);
      setReload((value) => value + 1);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Не удалось сохранить',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Доступ"
        title="Учётные записи сотрудников"
        description="Создание, роли и смена паролей доступны только корневому администратору."
        actions={
          <button
            className="button primary"
            onClick={() => {
              setFailure('');
              setSelected('new');
            }}
          >
            Создать учётную запись
          </button>
        }
      />
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <ErrorState message={state.error || 'Нет данных'} />
      ) : (
        <section className="card table-card">
          <DataTable
            rows={state.data}
            columns={columns}
            rowKey={(row) => row.id}
          />
        </section>
      )}
      <Dialog
        open={selected !== null}
        title={
          selected === 'new'
            ? 'Создать учётную запись'
            : `Настроить ${account?.username || ''}`
        }
        dismissDisabled={busy}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <form
          key={account?.id || 'new'}
          className="form-stack"
          onSubmit={submit}
        >
          {selected === 'new' && (
            <>
              <label>
                Логин
                <input
                  name="username"
                  autoComplete="off"
                  required
                  minLength={3}
                  maxLength={64}
                />
              </label>
              <label>
                Имя сотрудника
                <input name="name" required maxLength={100} />
              </label>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                ID существующего пользователя (необязательно)
                <input name="userId" />
              </label>
            </>
          )}
          <label>
            Роль
            <select name="role" defaultValue={account?.role || 'MODERATOR'}>
              <option value="MODERATOR">Модератор</option>
              <option value="ADMIN">Администратор</option>
              <option value="FULL_ADMIN">Корневой администратор</option>
            </select>
          </label>
          <label>
            {selected === 'new'
              ? 'Пароль'
              : 'Новый пароль (оставьте пустым, чтобы сохранить)'}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={16}
              maxLength={72}
              required={selected === 'new'}
            />
          </label>
          {account && (
            <label>
              <input
                name="disabled"
                type="checkbox"
                defaultChecked={account.disabled}
                disabled={account.userId === actorId}
              />{' '}
              Отключить доступ
            </label>
          )}
          <p>
            Смена пароля, роли или отключение завершат действующие сессии
            сотрудника.
          </p>
          {failure && (
            <p className="state-error" role="alert">
              {failure}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Отмена
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!resetTarget}
        title="Сбросить двухфакторную защиту сотрудника"
        dismissDisabled={busy}
        onClose={() => {
          if (!busy) setResetTarget(null);
        }}
      >
        <form
          key={resetTarget?.id}
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !resetTarget) return;
            const fields = new FormData(event.currentTarget);
            setBusy(true);
            setFailure('');
            try {
              await adminAuthService.resetTotp(
                resetTarget.id,
                String(fields.get('rootPassword')),
                String(fields.get('reason')).trim(),
              );
              setResetTarget(null);
              setReload((value) => value + 1);
            } catch (error) {
              setFailure(
                error instanceof Error
                  ? error.message
                  : 'Не удалось сбросить защиту',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Сотрудник: <strong>{resetTarget?.username}</strong>. Все его сессии
            будут завершены. Применяйте только после проверки личности; действие
            записывается в аудит.
          </p>
          <label>
            Ваш личный пароль FULL_ADMIN
            <input
              name="rootPassword"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <label>
            Основание сброса
            <textarea
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              disabled={busy}
            />
          </label>
          {failure && <p role="alert">{failure}</p>}
          <button className="button danger" disabled={busy}>
            {busy ? 'Сброс…' : 'Подтвердить сброс 2FA'}
          </button>
        </form>
      </Dialog>
    </>
  );
}
