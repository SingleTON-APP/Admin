import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../services/admin.service';
import { ReportsPage } from './ReportsPage';
import type { ReportsResult } from '../types/domain';
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
const populated: ReportsResult = {
  ...data,
  items: [
    {
      id: 'report-snapshot',
      targetType: 'POST',
      targetId: 'post-test',
      messageId: null,
      chatId: null,
      reason: 'Сохранённая жалоба',
      category: null,
      priority: 'HIGH',
      sourceContextId: null,
      status: 'OPEN',
      resolutionReason: null,
      resolvedAt: null,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      reporter: null,
      targetUser: null,
      assignee: null,
    },
  ],
};
afterEach(() => vi.restoreAllMocks());
describe('reports queue operational controls', () => {
  it('retains rows and timestamp through a pending and failed same-query refresh', async () => {
    let reject!: (reason: Error) => void;
    vi.spyOn(adminService, 'reports')
      .mockResolvedValueOnce(populated)
      .mockImplementationOnce(
        () =>
          new Promise((_, no) => {
            reject = no;
          }),
      );
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );
    await screen.findByText('Сохранённая жалоба');
    const timestamp = screen.getByText(
      /Последнее успешное обновление:/,
    ).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    expect(screen.getByText('Сохранённая жалоба')).toBeInTheDocument();
    expect(screen.getByText('Обновление очереди…')).toBeInTheDocument();
    await act(async () => reject(new Error('NetworkError')));
    expect(screen.getByText('Сохранённая жалоба')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Показаны последние полученные данные',
    );
    expect(screen.getByText(/Последнее успешное обновление:/).textContent).toBe(
      timestamp,
    );
  });

  it('clears old rows on filter change and ignores a late cancelled refresh', async () => {
    let resolveOld!: (value: ReportsResult) => void;
    let resolveNew!: (value: ReportsResult) => void;
    const reports = vi
      .spyOn(adminService, 'reports')
      .mockResolvedValueOnce(populated)
      .mockImplementationOnce(
        () =>
          new Promise((yes) => {
            resolveOld = yes;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((yes) => {
            resolveNew = yes;
          }),
      );
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );
    await screen.findByText('Сохранённая жалоба');
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    fireEvent.change(screen.getByLabelText('Тип объекта'), {
      target: { value: 'COMMENT' },
    });
    expect(screen.queryByText('Сохранённая жалоба')).not.toBeInTheDocument();
    expect(reports.mock.calls[1]?.[0]?.signal?.aborted).toBe(true);
    await act(async () =>
      resolveNew({
        ...populated,
        items: [{ ...populated.items[0]!, id: 'new', reason: 'Новая выборка' }],
      }),
    );
    await act(async () => resolveOld(populated));
    expect(screen.getByText('Новая выборка')).toBeInTheDocument();
    expect(screen.queryByText('Сохранённая жалоба')).not.toBeInTheDocument();
  });
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
