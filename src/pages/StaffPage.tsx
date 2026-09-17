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
import { adminService } from '../services/admin.service';
import type { StaffRole, StaffSummary } from '../types/domain';

export function StaffPage() {
  const admin = useAdmin();
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<StaffSummary | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [failure, setFailure] = useState('');
  const state = useAsync((signal) => adminService.staff(signal), [reload]);
  const columns: Column<StaffSummary>[] = [
    {
      key: 'name',
      header: 'Сотрудник',
      render: (staff) => (
        <span>
          <strong>{staff.name || staff.email}</strong>
          <br />
          <small>{staff.email}</small>
        </span>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      render: (staff) => <IDDisplay value={staff.publicId} />,
    },
    {
      key: 'role',
      header: 'Роль',
      render: (staff) => <StatusBadge value={staff.role} />,
    },
    {
      key: 'status',
      header: 'Статус',
      render: (staff) => <StatusBadge value={staff.status} />,
    },
    {
      key: 'assigned',
      header: 'Назначен',
      render: (staff) => new Date(staff.assignedAt).toLocaleDateString('ru-RU'),
    },
    {
      key: 'lastSeen',
      header: 'Последняя активность',
      render: (staff) =>
        staff.lastSeen ? new Date(staff.lastSeen).toLocaleString('ru-RU') : '—',
    },
    {
      key: 'lastAction',
      header: 'Последнее действие',
      render: (staff) => staff.lastAction?.action ?? '—',
    },
    {
      key: 'action',
      header: '',
      render: (staff) =>
        staff.id !== admin.id &&
        (admin.role === 'FULL_ADMIN' || staff.role === 'MODERATOR') ? (
          <button
            className="button secondary"
            onClick={() => setSelected(staff)}
          >
            Изменить
          </button>
        ) : null,
    },
  ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await adminService.changeRole(
        selected.id,
        String(form.get('role')) as StaffRole | 'USER',
        String(form.get('reason')),
      );
      setSelected(null);
      setReload((value) => value + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Ошибка');
    }
  }
  async function promote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await adminService.changeRole(
        String(form.get('userId')),
        String(form.get('role')) as StaffRole,
        String(form.get('reason')),
      );
      setPromoting(false);
      setReload((value) => value + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Ошибка');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Сотрудники"
        description="Роли и доступ к панели контролируются сервером"
        actions={
          <button className="button primary" onClick={() => setPromoting(true)}>
            Назначить сотрудника
          </button>
        }
      />
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <ErrorState message={state.error ?? 'Нет данных'} />
      ) : (
        <section className="card table-card">
          <DataTable
            rows={state.data}
            columns={columns}
            rowKey={(staff) => staff.id}
          />
        </section>
      )}
      <Dialog
        open={selected !== null}
        title="Изменить роль"
        onClose={() => setSelected(null)}
      >
        <form className="form-stack" onSubmit={submit}>
          <label>
            Новая роль
            <select name="role" defaultValue={selected?.role}>
              {admin.role === 'FULL_ADMIN' && (
                <>
                  <option value="FULL_ADMIN">Full Admin</option>
                  <option value="ADMIN">Admin</option>
                </>
              )}
              <option value="MODERATOR">Moderator</option>
              <option value="USER">Отключить доступ</option>
            </select>
          </label>
          <label>
            Причина
            <textarea name="reason" required maxLength={1000} />
          </label>
          {failure && <p className="state-error">{failure}</p>}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setSelected(null)}
            >
              Отмена
            </button>
            <button className="button primary">Сохранить</button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={promoting}
        title="Назначить сотрудника"
        onClose={() => setPromoting(false)}
      >
        <form className="form-stack" onSubmit={promote}>
          <label>
            ID или public ID пользователя
            <input name="userId" required />
          </label>
          <label>
            Роль
            <select name="role" defaultValue="MODERATOR">
              <option value="MODERATOR">Moderator</option>
              {admin.role === 'FULL_ADMIN' && (
                <>
                  <option value="ADMIN">Admin</option>
                  <option value="FULL_ADMIN">Full Admin</option>
                </>
              )}
            </select>
          </label>
          <label>
            Причина
            <textarea name="reason" required maxLength={1000} />
          </label>
          {failure && <p className="state-error">{failure}</p>}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setPromoting(false)}
            >
              Отмена
            </button>
            <button className="button primary">Назначить</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
