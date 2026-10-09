import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HistoryTrend } from './HistoryTrend';

describe('historical trend gaps', () => {
  it('breaks lines at missing observations and keeps measured zero', () => {
    const { container } = render(
      <HistoryTrend
        label="RTT"
        unit="мс"
        points={[10, 0, null, 20, 30].map((value, index) => ({
          timestamp: new Date(index * 60000).toISOString(),
          value,
        }))}
      />,
    );
    expect(
      screen.getByRole('img', { name: /RTT.*Пропуски/ }),
    ).toBeInTheDocument();
    const lines = container.querySelectorAll('polyline');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.getAttribute('points')).toContain(',135');
  });
  it('does not draw a healthy-looking zero line when all observations are missing', () => {
    render(
      <HistoryTrend
        label="Потери"
        unit="%"
        points={[{ timestamp: new Date().toISOString(), value: null }]}
      />,
    );
    expect(screen.getByText('Потери: нет измерений.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
