import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  adminAuthService,
  type AdminAccount,
} from '../../services/admin-auth.service';
import { StaffSessionsDialog } from './StaffSessionsDialog';

const account: AdminAccount = {
  id: 'account-1',
  userId: 'user-1',
  username: 'moderator',
  role: 'MODERATOR',
  disabled: false,
};
const session = {
  id: 'session-1',
  ip: '192.0.2.1',
  userAgent: 'Fixture browser',
  createdAt: '2026-10-11T08:00:00Z',
  lastSeenAt: '2026-10-11T08:01:00Z',
  expiresAt: '2026-10-12T08:00:00Z',
};
afterEach(() => vi.restoreAllMocks());

it('requires a reason, keeps failed revocations reviewable and refreshes after success', async () => {
  const listing = vi
    .spyOn(adminAuthService, 'staffSessions')
    .mockResolvedValueOnce({ items: [session] })
    .mockResolvedValue({ items: [] });
  const revoke = vi
    .spyOn(adminAuthService, 'revokeStaffSessions')
    .mockRejectedValueOnce(new Error('Сессия не завершена'))
    .mockResolvedValueOnce({ success: true, revokedCount: 1 });
  const changed = vi.fn();
  render(
    <StaffSessionsDialog
      account={account}
      onClose={vi.fn()}
      onChanged={changed}
    />,
  );
  expect(await screen.findByText(session.ip)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Завершить сессию' }));
  const dialog = screen.getByRole('dialog');
  const confirm = within(dialog).getByRole('button', {
    name: 'Подтвердить завершение сессии',
  });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Причина завершения'), {
    target: { value: 'Устройство потеряно сотрудником' },
  });
  fireEvent.click(confirm);
  await screen.findByRole('alert');
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Причина завершения')).toHaveValue(
    'Устройство потеряно сотрудником',
  );
  fireEvent.click(confirm);
  await screen.findByText('Активных сессий нет.');
  expect(revoke).toHaveBeenLastCalledWith(
    'account-1',
    'Устройство потеряно сотрудником',
    'session-1',
  );
  expect(changed).toHaveBeenCalledTimes(1);
  expect(listing).toHaveBeenCalledTimes(2);
});

it('revokes every device only after an explicit confirmation', async () => {
  vi.spyOn(adminAuthService, 'staffSessions').mockResolvedValue({
    items: [session],
  });
  const revoke = vi
    .spyOn(adminAuthService, 'revokeStaffSessions')
    .mockResolvedValue({ success: true, revokedCount: 1 });
  render(
    <StaffSessionsDialog
      account={account}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByText(session.ip);
  fireEvent.click(screen.getByRole('button', { name: 'Завершить все сессии' }));
  expect(revoke).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Причина завершения'), {
    target: { value: 'Проверка подозрительных входов' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Подтвердить завершение всех сессий' }),
  );
  await waitFor(() =>
    expect(revoke).toHaveBeenCalledWith(
      'account-1',
      'Проверка подозрительных входов',
      undefined,
    ),
  );
});
