import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  );
}
afterEach(() => vi.restoreAllMocks());

describe('moderator workbench', () => {
  it('leads with description, hides technical IDs and never loads private context implicitly', async () => {
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
    expect(within(summary).getByText('post-1')).not.toBeVisible();
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
