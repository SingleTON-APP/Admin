import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../features/admin-access/AdminContext';
import { adminService } from '../services/admin.service';
import type { ReportDetails, StaffIdentity } from '../types/domain';
import { ReportDetailsPage } from './ReportDetailsPage';

const admin: StaffIdentity = {
  id: 'staff-1',
  publicId: 'staff-public-1',
  name: 'Админ',
  email: 'admin@example.test',
  role: 'ADMIN',
};
const report: ReportDetails = {
  id: 'report-1',
  targetType: 'POST',
  targetId: 'post-1',
  messageId: null,
  chatId: null,
  reason: 'Автор публикует мошеннические предложения',
  category: 'FRAUD',
  priority: 'HIGH',
  sourceContextId: 'topic-1',
  status: 'OPEN',
  resolutionReason: null,
  resolvedAt: null,
  createdAt: '2026-10-08T12:00:00Z',
  updatedAt: '2026-10-08T12:00:00Z',
  reporter: {
    id: 'reporter-1',
    publicId: 'reporter-public',
    username: 'reporter',
    firstName: 'Имя',
    lastName: '',
    avatar: null,
    role: 'USER',
  },
  targetUser: null,
  assignee: null,
  relatedReportsCount: 2,
  history: [],
  notes: [
    {
      id: 'note-1',
      body: 'Ранее уже проверяли публикацию',
      author: null,
      createdAt: '2026-10-08T12:30:00Z',
    },
  ],
  targetRisk: { priorReports: 0, sanctions: [] },
};
function mount(from?: string) {
  vi.spyOn(adminService, 'report').mockResolvedValue(report);
  vi.spyOn(adminService, 'staff').mockResolvedValue([]);
  return render(
    <AdminContext.Provider value={admin}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/admin/reports/report-1',
            state: from ? { from } : null,
          },
        ]}
      >
        <Routes>
          <Route path="/admin/reports/:id" element={<ReportDetailsPage />} />
          <Route path="/admin/reports" element={<QueueResult />} />
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  );
}
function QueueResult() {
  const location = useLocation();
  return <p>{location.state?.notice}</p>;
}
async function decide(advance = true) {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Завершить жалобу' }),
  );
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Причина'), {
    target: { value: 'Нарушение проверено модератором' },
  });
  if (!advance) fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));
}
afterEach(() => vi.restoreAllMocks());

describe('moderator workbench', () => {
  it('saves the decision before advancing and preserves queue filters and ordering', async () => {
    const update = vi
      .spyOn(adminService, 'updateReportStatus')
      .mockResolvedValue(report);
    const next = vi
      .spyOn(adminService, 'reports')
      .mockResolvedValue({ items: [{ ...report, id: 'report-2' }] } as never);
    mount('/admin/reports?priority=HIGH&view=mine&sort=age&order=asc&page=3');
    await decide();
    await waitFor(() => expect(next).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      'report-1',
      'RESOLVED',
      'Нарушение проверено модератором',
    );
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      next.mock.invocationCallOrder[0]!,
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'HIGH',
        view: 'mine',
        sort: 'age',
        order: 'asc',
        page: 1,
        pageSize: 1,
        activeOnly: true,
        excludeId: 'report-1',
      }),
    );
    await waitFor(() =>
      expect(adminService.report).toHaveBeenCalledWith(
        'report-2',
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByRole('link', { name: 'К очереди' })).toHaveAttribute(
      'href',
      '/admin/reports?priority=HIGH&view=mine&sort=age&order=asc&page=3',
    );
  });
  it('returns to the queue with a completion notice when no active reports remain', async () => {
    vi.spyOn(adminService, 'updateReportStatus').mockResolvedValue(report);
    vi.spyOn(adminService, 'reports').mockResolvedValue({ items: [] } as never);
    mount();
    await decide();
    expect(
      await screen.findByText(
        'Решение сохранено. Открытых жалоб по этим фильтрам больше нет.',
      ),
    ).toBeVisible();
  });
  it('retries only the next-report request if loading fails after a saved decision', async () => {
    const update = vi
      .spyOn(adminService, 'updateReportStatus')
      .mockResolvedValue(report);
    const next = vi
      .spyOn(adminService, 'reports')
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ items: [] } as never);
    mount();
    await decide();
    const retry = await screen.findByRole('button', {
      name: 'Повторить переход',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Решение сохранено');
    fireEvent.click(retry);
    await screen.findByText(
      'Решение сохранено. Открытых жалоб по этим фильтрам больше нет.',
    );
    expect(next).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('stays on the report when automatic advance is disabled or saving fails', async () => {
    const update = vi
      .spyOn(adminService, 'updateReportStatus')
      .mockRejectedValueOnce(new Error('Решение не сохранено'))
      .mockResolvedValueOnce(report);
    const next = vi.spyOn(adminService, 'reports');
    mount();
    await decide(false);
    await screen.findByText('Решение не сохранено');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(next).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Подтвердить',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(next).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: 'Причина жалобы' }),
    ).toBeVisible();
    expect(update).toHaveBeenCalledTimes(2);
  });
  it('shows the target and description while keeping private context behind an audited request', async () => {
    const context = vi.spyOn(adminService, 'reportContext').mockResolvedValue({
      kind: 'POST',
      appliedLevel: 'REPORTED_ONLY',
      target: {
        id: 'post-1',
        body: 'Содержимое публикации',
        author: {
          publicId: 'author-1',
          username: 'author',
          displayName: 'Автор публикации',
        },
        createdAt: '2026-10-08T11:00:00Z',
        deleted: false,
        topicHashtag: '#объявления',
      },
    });
    mount('/admin/reports?priority=HIGH&page=2');
    const summary = await screen.findByRole('region', {
      name: 'Причина жалобы',
    });
    expect(within(summary).getByText(report.reason)).toBeVisible();
    expect(
      within(summary).getByText('Пост · Мошенничество'),
    ).toBeInTheDocument();
    expect(within(summary).getByText('post-1')).toBeVisible();
    expect(screen.getByRole('link', { name: 'К очереди' })).toHaveAttribute(
      'href',
      '/admin/reports?priority=HIGH&page=2',
    );
    expect(screen.getByRole('link', { name: 'К действиям' })).toHaveAttribute(
      'href',
      '#report-actions',
    );
    expect(context).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Содержимое жалобы' }));
    await screen.findByText('Содержимое публикации');
    expect(screen.getByText('Автор публикации')).toBeInTheDocument();
    expect(document.querySelector('.context-location')).toHaveTextContent(
      '#объявления',
    );
    expect(context).toHaveBeenCalledWith(
      'report-1',
      expect.objectContaining({ level: 'REPORTED_ONLY' }),
    );
  });
  it('separates notes and prior violations into accessible keyboard tabs', async () => {
    mount();
    const history = await screen.findByRole('tab', {
      name: 'История обработки',
    });
    expect(history).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(report.notes[0]!.body)).not.toBeInTheDocument();
    history.focus();
    fireEvent.keyDown(history, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Заметки (1)' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      report.notes[0]!.body,
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Заметки (1)' }), {
      key: 'End',
    });
    expect(
      screen.getByRole('tab', { name: 'Автор и нарушения' }),
    ).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Автор или субъект не определён.',
    );
    expect(
      screen.getByRole('complementary', { name: 'Действия по жалобе' }),
    ).toContainElement(screen.getByRole('button', { name: 'Взять в работу' }));
  });
  it('returns direct links to the general report queue', async () => {
    mount();
    await screen.findByRole('region', { name: 'Причина жалобы' });
    expect(screen.getByRole('link', { name: 'К очереди' })).toHaveAttribute(
      'href',
      '/admin/reports',
    );
  });
});
