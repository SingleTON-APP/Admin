import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SystemBadge, TrendChart, TypeDistribution } from './DashboardWidgets';

describe('dashboard widgets', () => {
  it('offers accessible exact values and preserves missing versus zero secondary data', () => {
    const { container } = render(
      <TrendChart
        label="Регистрации"
        secondaryLabel="Активность"
        points={[
          { date: '2026-10-01', count: 3, secondary: 0 },
          { date: '2026-10-02', count: 5 },
          { date: '2026-10-03', count: 4, secondary: 7 },
        ]}
      />,
    );
    expect(screen.getByText('Точные значения по дням')).toBeInTheDocument();
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
    expect(container.querySelectorAll('.chart-point-secondary')).toHaveLength(
      2,
    );
    expect(container.querySelectorAll('.chart-line-secondary')).toHaveLength(0);
    expect(screen.getByRole('img', { name: /Активность — 0/ })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
  it('draws a single point and handles no observations', () => {
    const { container, rerender } = render(
      <TrendChart label="Жалобы" points={[{ date: '2026-10-01', count: 0 }]} />,
    );
    expect(container.querySelector('.chart-point-primary')).toHaveAttribute(
      'cx',
      '333',
    );
    expect(container.querySelector('svg')?.innerHTML).not.toContain('NaN');
    rerender(<TrendChart label="Жалобы" points={[]} />);
    expect(
      screen.getByText('За выбранный период данных нет.'),
    ).toBeInTheDocument();
  });
  it('links each type to the real queue and shows share of total, not largest category', () => {
    const { container } = render(
      <MemoryRouter>
        <TypeDistribution
          items={[
            { type: 'POST', count: 3 },
            { type: 'MESSAGE', count: 1 },
          ]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('link', { name: 'Посты: 3 жалоб, 75%' }),
    ).toHaveAttribute('href', '/admin/reports?targetType=POST');
    expect(container.querySelector('.distribution-row i')).toHaveStyle({
      width: '75%',
    });
  });
  it('treats zero totals as empty', () => {
    render(<TypeDistribution items={[{ type: 'POST', count: 0 }]} />);
    expect(screen.getByText('Жалоб пока нет.')).toBeInTheDocument();
  });
  it('renders Russian service states and keeps unknown state neutral', () => {
    const { container, rerender } = render(
      <SystemBadge name="API" value={{ status: 'HEALTHY', latencyMs: 0 }} />,
    );
    expect(screen.getByText('Работает')).toBeInTheDocument();
    expect(screen.getByText('0 мс')).toBeInTheDocument();
    rerender(<SystemBadge name="API" value={{ status: 'UNKNOWN' }} />);
    expect(screen.getByText('Нет данных')).toHaveClass('status-neutral');
    expect(container.textContent).not.toContain('HEALTHY');
    expect(screen.getByText('Задержка не измерена')).toBeInTheDocument();
  });
});
