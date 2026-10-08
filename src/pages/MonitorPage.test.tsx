import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../services/admin.service';
import { usageService, type UsageSummary } from '../services/usage.service';
import type { Dashboard } from '../types/domain';
import { MonitorPage } from './MonitorPage';
import { processMetricsService } from '../services/process-metrics.service';

const dashboard: Dashboard = {
  generatedAt: '2026-10-08T10:00:00Z',
  metrics: {
    totalUsers: 42,
    activeUsers24h: 2,
    newUsers24h: 1,
    messages24h: 3,
    posts24h: 0,
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
    database: { status: 'HEALTHY' },
    posts: { status: 'HEALTHY' },
  },
};
const usage: UsageSummary = {
  available: true,
  days: 7,
  timezone: 'UTC',
  measurement: 'FOREGROUND_DEVICE_TIME',
  coverage: 'INSTRUMENTED_AUTHENTICATED_CLIENTS_ONLY',
  platforms: [{ platform: 'WEB', available: true }],
  totals: { measuredUsers: 2, foregroundMs: 240000, averageUserMs: 120000 },
  buckets: [],
  daily: [],
};
function mount() {
  return render(
    <MemoryRouter>
      <MonitorPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.spyOn(processMetricsService, 'snapshot').mockResolvedValue({
    generatedAt: '2026-10-08T10:00:00Z',
    startedAt: '2026-10-08T09:00:00Z',
    operations: [],
  });
  localStorage.clear();
  localStorage.setItem(
    'admin-monitor-settings',
    JSON.stringify({ seconds: 0 }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('independent monitoring snapshots', () => {
  it('renders dashboard without waiting for usage and keeps it when usage fails', async () => {
    vi.spyOn(adminService, 'dashboard').mockResolvedValue(dashboard);
    let fail!: (error: Error) => void;
    vi.spyOn(usageService, 'summary').mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    mount();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(
      screen.getByText('Загрузка времени использования…'),
    ).toBeInTheDocument();
    await act(async () => fail(new Error('usage offline')));
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Часть данных не обновлена')).toBeInTheDocument();
    expect(
      screen.getByText(/Время использования:/).parentElement?.textContent,
    ).toContain('успешных обновлений пока нет');
  });
  it('keeps last-good usage on failure while dashboard refreshes and recovers', async () => {
    vi.spyOn(adminService, 'dashboard').mockResolvedValue(dashboard);
    const summary = vi
      .spyOn(usageService, 'summary')
      .mockResolvedValueOnce(usage)
      .mockRejectedValueOnce(new Error('usage offline'))
      .mockResolvedValue(usage);
    mount();
    await screen.findByText('4 мин');
    fireEvent.click(screen.getByRole('button', { name: 'Обновить сейчас' }));
    await screen.findByText('Часть данных не обновлена');
    expect(screen.getByText('4 мин')).toBeInTheDocument();
    expect(
      screen.getByText(/Время использования:/).parentElement?.textContent,
    ).toContain('показаны устаревшие данные');
    fireEvent.click(screen.getByRole('button', { name: 'Обновить сейчас' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Часть данных не обновлена'),
      ).not.toBeInTheDocument(),
    );
    expect(summary).toHaveBeenCalledTimes(3);
  });
  it('renders usage even if dashboard fails and clears old usage on period change', async () => {
    vi.spyOn(adminService, 'dashboard').mockRejectedValue(
      new Error('dashboard offline'),
    );
    const summary = vi
      .spyOn(usageService, 'summary')
      .mockResolvedValueOnce(usage)
      .mockReturnValue(new Promise(() => {}));
    mount();
    await screen.findByText('4 мин');
    fireEvent.change(screen.getByLabelText('Период мониторинга'), {
      target: { value: '30' },
    });
    expect(screen.queryByText('4 мин')).not.toBeInTheDocument();
    expect(
      screen.getByText('Загрузка времени использования…'),
    ).toBeInTheDocument();
    expect(summary).toHaveBeenLastCalledWith(30, expect.any(AbortSignal));
  });
  it('works when localStorage is unavailable and exits wall mode on fullscreenchange', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(adminService, 'dashboard').mockResolvedValue(dashboard);
    vi.spyOn(usageService, 'summary').mockResolvedValue(usage);
    mount();
    await screen.findByText('42');
    fireEvent.click(screen.getByRole('button', { name: 'На весь экран' }));
    expect(document.documentElement).toHaveClass('monitor-wall-mode');
    fireEvent(document, new Event('fullscreenchange'));
    expect(document.documentElement).not.toHaveClass('monitor-wall-mode');
  });
});
