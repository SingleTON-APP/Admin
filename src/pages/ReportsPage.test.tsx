import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../services/admin.service';
import { ReportsPage } from './ReportsPage';
const data = {
  items: [],
  page: 3,
  limit: 25,
  total: 75,
  counts: { all: 75, new: 1, mine: 1, critical: 1, unassigned: 1 },
};
function Location() {
  return <output aria-label="Текущие фильтры">{useLocation().search}</output>;
}
afterEach(() => vi.restoreAllMocks());
describe('reports queue operational controls', () => {
  it('normalizes invalid URLs before requesting metadata and updates canonical URL', async () => {
    const reports = vi.spyOn(adminService, 'reports').mockResolvedValue(data);
    render(
      <MemoryRouter
        initialEntries={[
          '/admin/reports?page=Infinity&status=secret&order=wrong&age=-1',
        ]}
      >
        <ReportsPage />
        <Location />
      </MemoryRouter>,
    );
    await waitFor(() => expect(reports).toHaveBeenCalled());
    expect(reports.mock.calls[0]?.[0]).toMatchObject({
      page: 1,
      status: undefined,
      order: 'desc',
      olderThanHours: undefined,
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Текущие фильтры').textContent).toBe(''),
    );
  });
  it('manual refresh preserves filters/page and reports last successful refresh', async () => {
    const reports = vi.spyOn(adminService, 'reports').mockResolvedValue(data);
    render(
      <MemoryRouter
        initialEntries={[
          '/admin/reports?page=3&targetType=POST&sort=age&order=asc',
        ]}
      >
        <ReportsPage />
        <Location />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Обновить' })).toBeEnabled(),
    );
    expect(
      screen.getByText(/Последнее успешное обновление:/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await waitFor(() => expect(reports).toHaveBeenCalledTimes(2));
    expect(reports.mock.calls[1]?.[0]).toMatchObject({
      page: 3,
      targetType: 'POST',
      sort: 'age',
      order: 'asc',
    });
    expect(screen.getByLabelText('Текущие фильтры')).toHaveTextContent(
      '?page=3&targetType=POST&sort=age&order=asc',
    );
  });
});
