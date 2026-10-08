import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthService } from '../../services/health.service';
import { SidebarHealth } from './SidebarHealth';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe('sidebar service freshness', () => {
  it('keeps historical service states but clearly marks failed checks as stale', async () => {
    vi.spyOn(healthService, 'snapshot')
      .mockResolvedValueOnce({
        generatedAt: '2026-10-08T10:00:00Z',
        services: {
          api: { status: 'HEALTHY', latencyMs: 10 },
          database: { status: 'HEALTHY', latencyMs: 1 },
          posts: { status: 'DOWN' },
        },
      })
      .mockRejectedValue(new Error('offline'));
    render(<SidebarHealth />);
    await screen.findByText('Недоступен');
    fireEvent.click(screen.getByRole('button', { name: 'Обновить статусы' }));
    await screen.findByText('Статусы устарели: связь для проверки недоступна.');
    expect(screen.getByText('Недоступен')).toBeInTheDocument();
    expect(screen.getByText(/Последняя проверка/)).toBeInTheDocument();
    expect(
      document.querySelector('.health-services-stale'),
    ).toBeInTheDocument();
  });
  it('uses unknown states initially and tolerates disabled localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(healthService, 'snapshot').mockReturnValue(new Promise(() => {}));
    render(<SidebarHealth />);
    expect(screen.getAllByText('Нет данных')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Интервал обновления статусов'), {
      target: { value: '5' },
    });
    expect(screen.getByLabelText('Интервал обновления статусов')).toHaveValue(
      '5',
    );
  });
});
