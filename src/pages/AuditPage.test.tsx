import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../services/admin.service';
import { AuditPage } from './AuditPage';

const data = { items: [], total: 0, page: 1, limit: 25 };
afterEach(() => vi.restoreAllMocks());
describe('audit loading and navigation', () => {
  it('retries a failed real-service request without resetting its page', async () => {
    const audit = vi
      .spyOn(adminService, 'audit')
      .mockRejectedValueOnce(new Error('API недоступен'))
      .mockResolvedValueOnce(data);
    render(
      <MemoryRouter initialEntries={['/admin/audit?page=3']}>
        <AuditPage />
      </MemoryRouter>,
    );
    await screen.findByText(/API недоступен/);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    await waitFor(() => expect(audit).toHaveBeenCalledTimes(2));
    expect(audit.mock.calls[1]?.[0]).toMatchObject({ page: 3, pageSize: 25 });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Обновить журнал' }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole('button', { name: 'Следующая страница журнала' }),
    ).toBeDisabled();
  });
  it('never submits an infinite page from an untrusted URL', async () => {
    const audit = vi.spyOn(adminService, 'audit').mockResolvedValue(data);
    render(
      <MemoryRouter initialEntries={['/admin/audit?page=Infinity']}>
        <AuditPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(audit).toHaveBeenCalled());
    expect(audit.mock.calls[0]?.[0]).toMatchObject({ page: 1 });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Предыдущая страница журнала' }),
      ).toBeDisabled(),
    );
  });
});
