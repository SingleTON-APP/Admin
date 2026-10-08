import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usageService, type UsageSummary } from '../../services/usage.service';
import { UsagePanel } from './UsagePanel';
const empty: UsageSummary = {
  available: false,
  days: 7,
  timezone: 'UTC',
  measurement: 'FOREGROUND_DEVICE_TIME',
  coverage: 'INSTRUMENTED_AUTHENTICATED_CLIENTS_ONLY',
  platforms: [
    { platform: 'ANDROID', available: false },
    { platform: 'IOS', available: false },
    { platform: 'WEB', available: false },
  ],
  totals: null,
  buckets: [],
  daily: [],
};
afterEach(() => vi.restoreAllMocks());
describe('Usage panel', () => {
  it('shows loading before measured data exists', () => {
    vi.spyOn(usageService, 'summary').mockReturnValue(new Promise(() => {}));
    render(<UsagePanel days={7} />);
    expect(
      screen.getByRole('button', { name: 'Обновить время использования' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('Среднее на пользователя за 7 дней'),
    ).not.toBeInTheDocument();
  });
  it('shows unavailable platforms honestly without zero duration claims', async () => {
    vi.spyOn(usageService, 'summary').mockResolvedValue(empty);
    render(<UsagePanel days={7} />);
    expect(
      await screen.findByText(/Измерений за этот период пока нет/),
    ).toBeInTheDocument();
    expect(screen.getByText('Android: нет измерений')).toBeInTheDocument();
    expect(screen.getByText('iOS: нет измерений')).toBeInTheDocument();
    expect(screen.queryByText('0 с')).not.toBeInTheDocument();
  });
  it('retries after server error', async () => {
    const summary = vi
      .spyOn(usageService, 'summary')
      .mockRejectedValueOnce(new Error('Сервис недоступен'))
      .mockResolvedValue(empty);
    render(<UsagePanel days={30} />);
    expect(await screen.findByText(/Сервис недоступен/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Обновить время использования' }),
    );
    expect(
      await screen.findByText(/Измерений за этот период пока нет/),
    ).toBeInTheDocument();
    expect(summary).toHaveBeenCalledTimes(2);
    expect(summary).toHaveBeenLastCalledWith(30, expect.any(AbortSignal));
  });
  it('renders real platform/browser averages and explains foreground/device sum coverage', async () => {
    vi.spyOn(usageService, 'summary').mockResolvedValue({
      ...empty,
      available: true,
      platforms: [
        { platform: 'WEB', available: true },
        { platform: 'IOS', available: false },
      ],
      totals: { measuredUsers: 2, foregroundMs: 240000, averageUserMs: 120000 },
      buckets: [
        {
          platform: 'WEB',
          browser: 'FIREFOX',
          measuredUsers: 2,
          foregroundMs: 240000,
          averageUserMs: 120000,
          averageDailyUserMs: 60000,
        },
      ],
    });
    render(<UsagePanel days={7} />);
    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(
      screen.getByText('web.hub-net.org: есть измерения'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 мин')).toBeInTheDocument();
    expect(screen.getByText('4 мин')).toBeInTheDocument();
    expect(
      screen.getByText(/Параллельные устройства суммируются/),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
