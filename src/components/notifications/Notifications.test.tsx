import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../../features/admin-access/AdminContext';
import {
  notificationsService,
  type AdminNotification,
  type NotificationPage,
} from '../../services/notifications.service';
import type { StaffIdentity } from '../../types/domain';
import {
  NotificationBell,
  NotificationsProvider,
  useNotifications,
} from './Notifications';

const admin: StaffIdentity = {
  id: 'staff-a',
  publicId: 'staff-a',
  name: 'Admin A',
  email: '',
  role: 'ADMIN',
};
const item = (
  id = 'incident-a',
  revision = 1,
  kind: AdminNotification['kind'] = 'SERVICE',
): AdminNotification => ({
  id,
  revision,
  kind,
  severity: 'ERROR',
  title: `${kind} ${id}`,
  message: 'Описание события',
  createdAt: '2026-10-08T09:00:00Z',
  updatedAt: '2026-10-08T09:00:00Z',
  resolvedAt: null,
  occurrences: revision,
  read: false,
  metadata: {},
});
const page = (items: AdminNotification[]): NotificationPage => ({
  items,
  unreadCount: items.filter((value) => !value.read).length,
  generatedAt: '2026-10-08T10:00:00Z',
  nextCursor: null,
});
function Probe() {
  const state = useNotifications();
  return (
    <>
      <button onClick={state.refresh}>Обновить тест</button>
      <output aria-label="Счётчик тест">
        {state.data?.unreadCount ?? 'неизвестно'}
      </output>
    </>
  );
}
const tree = (identity = admin) => (
  <MemoryRouter>
    <AdminContext.Provider value={identity}>
      <NotificationsProvider key={`${identity.id}:${identity.role}`}>
        <NotificationBell />
        <Probe />
      </NotificationsProvider>
    </AdminContext.Provider>
  </MemoryRouter>
);
const toasts = () =>
  screen.getByRole('complementary', { name: 'Новые уведомления' });
afterEach(() => vi.restoreAllMocks());

describe('notification revision and identity lifecycle', () => {
  it('suppresses initial flood and duplicate revisions while updating an incident toast', async () => {
    vi.spyOn(notificationsService, 'list')
      .mockResolvedValueOnce(page([item()]))
      .mockResolvedValueOnce(page([item('incident-a', 2)]))
      .mockResolvedValueOnce(page([item('incident-a', 2)]))
      .mockResolvedValueOnce(page([item('incident-a', 3)]));
    render(tree());
    await waitFor(() =>
      expect(screen.getByLabelText('Счётчик тест')).toHaveTextContent('1'),
    );
    expect(within(toasts()).queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Обновить тест'));
    await within(toasts()).findByText('SERVICE incident-a');
    expect(within(toasts()).getAllByRole('article')).toHaveLength(1);
    fireEvent.click(
      within(toasts()).getByRole('button', { name: /Скрыть уведомление/ }),
    );
    fireEvent.click(screen.getByText('Обновить тест'));
    await waitFor(() =>
      expect(notificationsService.list).toHaveBeenCalledTimes(3),
    );
    expect(within(toasts()).queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Обновить тест'));
    await within(toasts()).findByText('SERVICE incident-a');
    expect(within(toasts()).getAllByRole('article')).toHaveLength(1);
  });
  it('clears snapshots and aborts old requests on account switch; new account has its own read state', async () => {
    let resolveOld!: (value: NotificationPage) => void;
    let resolveNew!: (value: NotificationPage) => void;
    const list = vi
      .spyOn(notificationsService, 'list')
      .mockResolvedValueOnce(page([item()]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }),
      );
    const view = render(tree());
    await waitFor(() =>
      expect(screen.getByLabelText('Счётчик тест')).toHaveTextContent('1'),
    );
    fireEvent.click(screen.getByText('Обновить тест'));
    view.rerender(tree({ ...admin, id: 'staff-b', name: 'Admin B' }));
    expect(list.mock.calls[1]?.[0]?.aborted).toBe(true);
    expect(screen.getByLabelText('Счётчик тест')).toHaveTextContent(
      'неизвестно',
    );
    await act(async () => {
      resolveNew(page([{ ...item(), read: true }]));
      resolveOld(page([item('private-old', 3, 'SECURITY')]));
    });
    expect(screen.getByLabelText('Счётчик тест')).toHaveTextContent('0');
    expect(screen.queryByText('SECURITY private-old')).not.toBeInTheDocument();
    expect(within(toasts()).queryByRole('article')).not.toBeInTheDocument();
  });
  it('filters security contents for moderators on initial list and later updates', async () => {
    vi.spyOn(notificationsService, 'list')
      .mockResolvedValueOnce(page([item('secret', 1, 'SECURITY'), item()]))
      .mockResolvedValueOnce(
        page([item('secret', 2, 'SECURITY'), item('incident-a', 2)]),
      );
    render(tree({ ...admin, role: 'MODERATOR' }));
    await waitFor(() =>
      expect(notificationsService.list).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByText('Обновить тест'));
    await within(toasts()).findByText('SERVICE incident-a');
    expect(screen.queryByText('SECURITY secret')).not.toBeInTheDocument();
  });
});
