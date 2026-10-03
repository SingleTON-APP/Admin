import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../features/admin-access/AdminContext';
import { StaffPage } from './StaffPage';
import { SecurityPage } from './SecurityPage';
import { adminAuthService } from '../services/admin-auth.service';
vi.mock('../services/admin-auth.service', () => ({
  adminAuthService: { staff: vi.fn() },
}));
describe('Root-only staff management', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(['ADMIN', 'MODERATOR'] as const)(
    'never queries staff credentials for %s',
    (role) => {
      render(
        <AdminContext.Provider
          value={{
            id: 'actor',
            publicId: 'actor',
            name: 'Actor',
            email: '',
            role,
          }}
        >
          <StaffPage />
          <SecurityPage />
        </AdminContext.Provider>,
      );
      expect(adminAuthService.staff).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('button', { name: 'Создать учётную запись' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Новый общий пароль'),
      ).not.toBeInTheDocument();
    },
  );
  it('shows account management for root', async () => {
    vi.mocked(adminAuthService.staff).mockResolvedValue([]);
    render(
      <AdminContext.Provider
        value={{
          id: 'actor',
          publicId: 'actor',
          name: 'Actor',
          email: '',
          role: 'FULL_ADMIN',
        }}
      >
        <StaffPage />
      </AdminContext.Provider>,
    );
    expect(
      await screen.findByRole('button', { name: 'Создать учётную запись' }),
    ).toBeInTheDocument();
  });
});
