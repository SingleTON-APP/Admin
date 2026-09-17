import { useNavigate, useSearchParams } from 'react-router-dom';
import type { UserSummary } from '../types/domain';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import {
  Avatar,
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { DataTable, type Column } from '../components/ui/DataTable';

export function UsersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
  const sort = params.get('sort') ?? 'createdAt';
  const order = params.get('order') ?? 'DESC';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const state = useAsync(
    (signal) =>
      adminService.users({
        page,
        pageSize: 25,
        search,
        status,
        role,
        sort,
        order,
        signal,
      }),
    [page, search, status, role, sort, order],
  );
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  const columns: Column<UserSummary>[] = [
    {
      key: 'user',
      header: 'Пользователь',
      render: (user) => (
        <div className="user-cell">
          <Avatar name={`${user.firstName} ${user.lastName}`} />
          <span>
            <strong>
              {`${user.firstName} ${user.lastName}`.trim() || user.username}
            </strong>
            <small>@{user.username}</small>
          </span>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      render: (user) => <IDDisplay value={user.publicId} />,
    },
    { key: 'email', header: 'Email', render: (user) => user.email },
    {
      key: 'status',
      header: 'Статус',
      render: (user) => <StatusBadge value={user.status} />,
    },
    {
      key: 'lastSeen',
      header: 'Последняя активность',
      render: (user) =>
        user.lastSeen ? new Date(user.lastSeen).toLocaleString('ru-RU') : '—',
    },
    {
      key: 'reports',
      header: 'Жалобы',
      render: (user) => (
        <span className={user.reportCount ? 'count-alert' : ''}>
          {user.reportCount}
        </span>
      ),
    },
    { key: 'role', header: 'Роль', render: (user) => user.role },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Users"
        title="Пользователи"
        description={
          state.data
            ? `${state.data.total.toLocaleString('ru-RU')} записей`
            : 'Загрузка списка'
        }
      />
      <div className="filter-bar">
        <input
          value={search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Имя, username, email или ID"
        />
        <select
          value={status}
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
          <option value="DELETED">Deleted</option>
        </select>
        <select
          value={role}
          onChange={(event) => update('role', event.target.value)}
        >
          <option value="">Все роли</option>
          <option value="USER">User</option>
          <option value="MODERATOR">Moderator</option>
          <option value="ADMIN">Admin</option>
          <option value="FULL_ADMIN">Full Admin</option>
        </select>
        <select
          value={`${sort}:${order}`}
          onChange={(event) => {
            const [nextSort = 'createdAt', nextOrder = 'DESC'] =
              event.target.value.split(':');
            const next = new URLSearchParams(params);
            next.set('sort', nextSort);
            next.set('order', nextOrder);
            next.delete('page');
            setParams(next);
          }}
          aria-label="Сортировка"
        >
          <option value="createdAt:DESC">Сначала новые</option>
          <option value="createdAt:ASC">Сначала старые</option>
          <option value="lastSeen:DESC">Недавно активные</option>
          <option value="username:ASC">Username A–Z</option>
        </select>
      </div>
      {state.loading ? (
        <LoadingState />
      ) : state.error || !state.data ? (
        <ErrorState message={state.error ?? 'Нет данных'} />
      ) : (
        <section className="card table-card">
          <DataTable
            rows={state.data.items}
            columns={columns}
            rowKey={(user) => user.id}
            onRowClick={(user) => navigate(`/admin/users/${user.publicId}`)}
          />
          <div className="pagination">
            <span>Страница {page}</span>
            <div>
              <button
                disabled={page === 1}
                onClick={() => update('page', String(page - 1))}
              >
                ←
              </button>
              <button className="active">{page}</button>
              <button
                disabled={page * state.data.limit >= state.data.total}
                onClick={() => update('page', String(page + 1))}
              >
                →
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
