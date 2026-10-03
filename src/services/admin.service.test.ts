import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api/client';
import { adminService } from './admin.service';

vi.mock('../api/client', () => ({ request: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('dashboard contract', () => {
  it('does not invent zero registrations for an absent count', async () => {
    vi.mocked(request).mockResolvedValue({
      recentActions: [],
      registrationTrend: [{ date: '2026-10-03' }],
    });
    expect(
      (await adminService.dashboard()).registrationTrend[0]?.count,
    ).toBeNaN();
  });
  it('joins activity and registration series by calendar date, not position', async () => {
    vi.mocked(request).mockResolvedValue({
      recentActions: [],
      registrationTrend: [
        { date: '2026-09-29T00:00:00.000Z', registrations: '12' },
        { date: '2026-09-30', registrations: 3 },
      ],
      activityTrend: [
        { date: '2026-09-30', activeUsers: 45 },
        { date: '2026-09-29', activeUsers: 81 },
      ],
    });
    const dashboard = await adminService.dashboard();
    expect(
      dashboard.registrationTrend.map(({ count, secondary }) => ({
        count,
        secondary,
      })),
    ).toEqual([
      { count: 12, secondary: 81 },
      { count: 3, secondary: 45 },
    ]);
  });

  it('does not invent zero activity when the backend has no activity series', async () => {
    vi.mocked(request).mockResolvedValue({
      recentActions: [],
      registrationTrend: [{ date: '2026-09-30', registrations: 3 }],
    });
    expect(
      (await adminService.dashboard()).registrationTrend[0]?.secondary,
    ).toBeUndefined();
  });
  it('keeps an absent activity date distinct from an actual zero', async () => {
    vi.mocked(request).mockResolvedValue({
      recentActions: [],
      registrationTrend: [
        { date: '2026-09-29', registrations: 3 },
        { date: '2026-09-30', registrations: 4 },
      ],
      activityTrend: [{ date: '2026-09-30', activeUsers: 0 }],
    });
    expect(
      (await adminService.dashboard()).registrationTrend.map(
        (point) => point.secondary,
      ),
    ).toEqual([undefined, 0]);
  });
});
