import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../features/admin-access/AdminContext';
import { NotificationsProvider } from '../components/notifications/Notifications';
import {
  notificationsService,
  type AdminNotification,
} from '../services/notifications.service';
import { NotificationsPage } from './NotificationsPage';

const event: AdminNotification = {
  id: 'event-1',
  revision: 4,
  kind: 'SERVICE',
  severity: 'ERROR',
  title: 'API недоступен',
  message: 'Соединение отклонено',
  createdAt: '2026-10-08T10:00:00Z',
  updatedAt: '2026-10-08T10:00:00Z',
  resolvedAt: null,
  occurrences: 2,
  read: false,
  metadata: { serviceId: 'api' },
};
function mount() {
  return render(
    <MemoryRouter>
      <AdminContext.Provider
        value={{
          id: 'staff-1',
          publicId: 'staff-1',
          name: 'Admin',
          email: '',
          role: 'ADMIN',
        }}
      >
        <NotificationsProvider>
          <NotificationsPage />
        </NotificationsProvider>
      </AdminContext.Provider>
    </MemoryRouter>,
  );
}
afterEach(() => vi.restoreAllMocks());
describe('notification history actions', () => {
  it('marks only the exact displayed incident revisions', async () => {
    vi.spyOn(notificationsService, 'list').mockResolvedValue({
      items: [event],
      unreadCount: 1,
      generatedAt: event.updatedAt,
      nextCursor: null,
    });
    const read = vi
      .spyOn(notificationsService, 'readShown')
      .mockResolvedValue(undefined);
    mount();
    await screen.findByRole('heading', { name: event.title });
    fireEvent.click(
      screen.getByRole('button', { name: 'Прочитать показанные' }),
    );
    await waitFor(() => expect(read).toHaveBeenCalledWith([event]));
  });
  it('clears old action targets while loading an earlier history page', async () => {
    const list = vi
      .spyOn(notificationsService, 'list')
      .mockResolvedValueOnce({
        items: [event],
        unreadCount: 1,
        generatedAt: event.updatedAt,
        nextCursor: 'opaque-cursor',
      })
      .mockImplementationOnce(() => new Promise(() => {}));
    mount();
    await screen.findByRole('heading', { name: event.title });
    fireEvent.click(screen.getByRole('button', { name: 'Более ранние' }));
    await waitFor(() => expect(list.mock.calls[1]?.[1]).toBe('opaque-cursor'));
    expect(
      screen.queryByRole('heading', { name: event.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Прочитать показанные' }),
    ).toBeDisabled();
  });
});
