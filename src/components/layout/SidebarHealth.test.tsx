import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
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
    await screen.findByRole('img', { name: 'Недоступен' });
    fireEvent.click(screen.getByRole('button', { name: 'Обновить статусы' }));
    await screen.findByText('Статусы устарели: связь для проверки недоступна.');
    expect(
      screen.getByRole('img', { name: 'Недоступен (предыдущая проверка)' }),
    ).toBeInTheDocument();
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
    expect(screen.getAllByRole('img', { name: 'Нет данных' })).toHaveLength(5);
    fireEvent.change(screen.getByLabelText('Интервал обновления статусов'), {
      target: { value: '5' },
    });
    expect(screen.getByLabelText('Интервал обновления статусов')).toHaveValue(
      '5',
    );
  });
  it('keeps five primary services visible and promotes only confirmed additional failures', async () => {
    const result = {
      generatedAt: '2026-10-08T10:00:00Z',
      services: {
        api: { status: 'HEALTHY' as const },
        database: { status: 'HEALTHY' as const },
        redis: { status: 'HEALTHY' as const },
        messages: { status: 'HEALTHY' as const },
        calls: { status: 'UNKNOWN' as const },
        posts: {
          status: 'DOWN' as const,
          checkedAt: '2026-10-08T10:00:00Z',
          reason: 'Не отвечает проверка gRPC',
          probe: 'grpc',
          primary: false,
        },
        auth: { status: 'DEGRADED' as const },
        search: { status: 'UNKNOWN' as const, configured: false },
        storage: { status: 'HEALTHY' as const },
      },
    };
    vi.spyOn(healthService, 'snapshot')
      .mockResolvedValueOnce(result)
      .mockResolvedValue({
        ...result,
        services: {
          ...result.services,
          posts: { status: 'HEALTHY' },
          auth: { status: 'HEALTHY' },
        },
      });
    render(<SidebarHealth />);
    const main = screen.getByRole('list', {
      name: 'Основные сервисы и обнаруженные сбои',
    });
    await within(main).findByText('Публикации');
    expect(within(main).getAllByRole('listitem')).toHaveLength(7);
    expect(within(main).getByText('Сообщения / WebSocket')).toBeInTheDocument();
    expect(within(main).getByText('Звонки')).toBeInTheDocument();
    expect(within(main).queryByText('Поиск')).not.toBeInTheDocument();
    expect(within(main).queryByText('Файлы')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Все сервисы' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Состояние всех сервисов',
    });
    expect(within(dialog).getByText('Не настроен')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Не отвечает проверка gRPC'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Проверка: grpc')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    fireEvent.click(screen.getByRole('button', { name: 'Обновить статусы' }));
    await waitFor(() =>
      expect(within(main).getAllByRole('listitem')).toHaveLength(5),
    );
    expect(within(main).queryByText('Публикации')).not.toBeInTheDocument();
  });
});
