import { usageService } from '../services/usage.service';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../features/admin-access/AdminContext';
import { adminService } from '../services/admin.service';
import type { Dashboard, StaffRole } from '../types/domain';
import { resolutionDuration } from '../components/dashboard/dashboard-format';
import { DashboardPage } from './DashboardPage';

const data: Dashboard = {
  generatedAt: '2026-10-03T10:00:00Z',
  metrics: {
    totalUsers: 10,
    activeUsers24h: 2,
    newUsers24h: 1,
    messages24h: 3,
    posts24h: null,
    openReports: 0,
    inReviewReports: 0,
    avgResolutionMinutes: null,
    highPriorityReports: 0,
  },
  queueAge: { lt1h: 0, h1to6: 0, h6to24: 0, gt24h: 0 },
  reportTrend: [],
  registrationTrend: [],
  reportsByType: [],
  recentActions: [],
  systemStatus: {
    api: { status: 'HEALTHY' },
    database: { status: 'HEALTHY', latencyMs: 4 },
    posts: { status: 'UNKNOWN' },
  },
};
function mount(role: StaffRole = 'ADMIN') {
  return render(
    <MemoryRouter>
      <AdminContext.Provider
        value={{
          id: 'staff-1',
          publicId: 'staff-1',
          name: 'Администратор',
          email: 'admin@example.test',
          role,
        }}
      >
        <DashboardPage />
      </AdminContext.Provider>
    </MemoryRouter>,
  );
}
beforeEach(() => vi.spyOn(usageService, 'summary').mockResolvedValue({ available: false, days: 7, timezone: 'UTC', measurement: 'FOREGROUND_DEVICE_TIME', coverage: 'INSTRUMENTED_AUTHENTICATED_CLIENTS_ONLY', platforms: [], totals: null, buckets: [], daily: [] }));
afterEach(() => vi.restoreAllMocks());

describe('dashboard operations', () => {
  it('keeps the header and provides a real retry after failure', async () => {
    let reject!: (error: Error) => void;
    const request = vi
      .spyOn(adminService, 'dashboard')
      .mockReturnValueOnce(
        new Promise((_, no) => {
          reject = no;
        }),
      )
      .mockResolvedValueOnce(data);
    mount();
    expect(
      screen.getByRole('heading', { name: 'Операционный центр' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Загрузка dashboard' }),
    ).toBeInTheDocument();
    reject(new Error('Сеть недоступна'));
    await screen.findByText('Ошибка: Сеть недоступна');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    await screen.findByText('Очередь обработана.', { exact: false });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('shows unavailable posts separately from zero counts and hides forbidden links', async () => {
    vi.spyOn(adminService, 'dashboard').mockResolvedValue(data);
    mount('MODERATOR');
    await screen.findByText('Статистика недоступна');
    expect(screen.getByText('Нет завершённых жалоб')).toBeInTheDocument();
    expect(screen.getByText('Жалоб пока нет.')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Журнал' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Подробнее' }),
    ).not.toBeInTheDocument();
  });
  it('switches the chart period locally and refreshes with one aggregate request', async () => {
    const request = vi.spyOn(adminService, 'dashboard').mockResolvedValue(data);
    mount();
    await screen.findByText('Статистика недоступна');
    fireEvent.change(screen.getByLabelText('Период графиков'), {
      target: { value: '7' },
    });
    expect(
      screen.getByText('Последние 7 дней · даты по UTC'),
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
  it('rounds resolution duration without producing sixty-minute remainders', () => {
    expect(resolutionDuration(59.9)).toBe('1 ч 0 мин');
    expect(resolutionDuration(1439.9)).toBe('1 д 0 ч');
    expect(resolutionDuration(null)).toBe('—');
  });
});
