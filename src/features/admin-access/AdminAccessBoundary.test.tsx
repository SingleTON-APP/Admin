import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessBoundary } from './AdminAccessBoundary';
import { ADMIN_ACCESS_EXPIRED } from '../../api/client';
import { adminAuthService } from '../../services/admin-auth.service';
import { useAdminLogout } from './LogoutContext';
vi.mock('../../services/admin-auth.service', () => ({
  adminAuthService: {
    session: vi.fn(),
    gate: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));
const actor = {
  id: 'root',
  publicId: 'root-public',
  name: 'Root',
  email: '',
  role: 'FULL_ADMIN' as const,
};
const gate = { gateAuthenticated: false, actor: null, csrfToken: 'first' };
const accepted = { gateAuthenticated: true, actor: null, csrfToken: 'second' };
const authorized = { gateAuthenticated: true, actor, csrfToken: 'third' };
function PrivatePanel() {
  const logout = useAdminLogout();
  return (
    <div>
      Приватный контекст<button onClick={() => void logout()}>Выйти</button>
    </div>
  );
}
describe('Admin access boundary', () => {
  beforeEach(() => vi.resetAllMocks());
  it('keeps private UI closed for a TOTP challenge and accepts a backup code', async () => {
    vi.mocked(adminAuthService.session).mockResolvedValue(accepted);
    vi.mocked(adminAuthService.login)
      .mockResolvedValueOnce({ ...accepted, requiresTotp: true })
      .mockResolvedValue(authorized);
    render(
      <AdminAccessBoundary>
        <PrivatePanel />
      </AdminAccessBoundary>,
    );
    fireEvent.change(await screen.findByLabelText('Логин'), {
      target: { value: 'root' },
    });
    fireEvent.change(screen.getByLabelText('Пароль сотрудника'), {
      target: { value: 'personal-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await screen.findByText('Введите код из приложения-аутентификатора.');
    expect(screen.queryByText('Приватный контекст')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Пароль сотрудника')).toHaveValue(
      'personal-secret',
    );
    fireEvent.change(screen.getByLabelText(/Код 2FA или резервный код/), {
      target: { value: 'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await screen.findByText('Приватный контекст');
    expect(adminAuthService.login).toHaveBeenLastCalledWith(
      'root',
      'personal-secret',
      'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd',
    );
  });
  it('does not mount private content before both gates pass', async () => {
    vi.mocked(adminAuthService.session).mockResolvedValue(gate);
    vi.mocked(adminAuthService.gate).mockResolvedValue(accepted);
    vi.mocked(adminAuthService.login).mockResolvedValue(authorized);
    render(
      <AdminAccessBoundary>
        <PrivatePanel />
      </AdminAccessBoundary>,
    );
    fireEvent.change(await screen.findByLabelText('Общий пароль'), {
      target: { value: 'shared-secret' },
    });
    expect(screen.queryByText('Приватный контекст')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    fireEvent.change(await screen.findByLabelText('Логин'), {
      target: { value: 'root' },
    });
    fireEvent.change(screen.getByLabelText('Пароль сотрудника'), {
      target: { value: 'personal-secret' },
    });
    expect(screen.queryByText('Приватный контекст')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(await screen.findByText('Приватный контекст')).toBeInTheDocument();
    expect(adminAuthService.login).toHaveBeenCalledWith(
      'root',
      'personal-secret',
    );
    expect(localStorage.getItem('password')).toBeNull();
  });
  it('shows server lockout and does not continue to personal login', async () => {
    vi.mocked(adminAuthService.session).mockResolvedValue(gate);
    vi.mocked(adminAuthService.gate).mockRejectedValue(
      new Error('IP заблокирован на час'),
    );
    render(
      <AdminAccessBoundary>
        <PrivatePanel />
      </AdminAccessBoundary>,
    );
    fireEvent.change(await screen.findByLabelText('Общий пароль'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'IP заблокирован на час',
    );
    expect(adminAuthService.login).not.toHaveBeenCalled();
  });
  it('unmounts private content on expired authorization', async () => {
    vi.mocked(adminAuthService.session)
      .mockResolvedValueOnce(authorized)
      .mockResolvedValue(gate);
    render(
      <AdminAccessBoundary>
        <PrivatePanel />
      </AdminAccessBoundary>,
    );
    await screen.findByText('Приватный контекст');
    window.dispatchEvent(new Event(ADMIN_ACCESS_EXPIRED));
    await screen.findByLabelText('Общий пароль');
    expect(screen.queryByText('Приватный контекст')).not.toBeInTheDocument();
  });
  it('does not restore private content when server logout fails', async () => {
    vi.mocked(adminAuthService.session).mockResolvedValue(authorized);
    vi.mocked(adminAuthService.logout).mockRejectedValue(new Error('offline'));
    render(
      <AdminAccessBoundary>
        <PrivatePanel />
      </AdminAccessBoundary>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Выйти' }));
    await waitFor(() =>
      expect(screen.queryByText('Приватный контекст')).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText(/Не удалось завершить сессию/),
    ).toBeInTheDocument();
    expect(adminAuthService.session).toHaveBeenCalledTimes(1);
  });
});
