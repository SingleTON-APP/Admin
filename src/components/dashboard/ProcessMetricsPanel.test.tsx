import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  ProcessOperation,
  ProcessSnapshot,
} from '../../services/process-metrics.service';
import { ProcessComparison, ProcessMetricsPanel } from './ProcessMetricsPanel';

const empty: ProcessOperation = {
  id: 'message.server',
  source: 'server',
  availability: 'NO_SAMPLES',
  count: 0,
  durationSamples: 0,
  errors: 0,
  p50Ms: null,
  p95Ms: null,
  meanMs: null,
  errorRate: null,
  ratePerMinute: 0,
  series: [],
};
const snapshot = (operations: ProcessOperation[]): ProcessSnapshot => ({
  generatedAt: '2026-10-08T10:00:00Z',
  startedAt: '2026-10-08T09:00:00Z',
  operations,
});

describe('honest process measurements', () => {
  it('keeps missing samples as graph gaps, including a valid zero latency', () => {
    const operation = {
      ...empty,
      series: [0, null, 200].map((value, index) => ({
        timestamp: `2026-10-08T10:0${index}:00Z`,
        count: value === null ? 0 : 1,
        durationSamples: value === null ? 0 : 1,
        errors: 0,
        p50Ms: value,
        p95Ms: value,
        meanMs: value,
      })),
    };
    const { container } = render(
      <ProcessComparison
        operations={[operation]}
        selected={[operation.id]}
        quantile="p95Ms"
      />,
    );
    expect(
      screen.getByRole('img', { name: /p95, миллисекунды/ }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(container.querySelector('circle')?.getAttribute('cy')).toBe('172');
  });
  it('distinguishes no instrumentation, no operations and failed acknowledgements without latency', () => {
    render(
      <ProcessMetricsPanel
        snapshot={snapshot([
          {
            ...empty,
            id: 'login.server',
            availability: 'NOT_INSTRUMENTED',
            source: 'auth-service',
          },
          empty,
          {
            ...empty,
            id: 'message.receiver_ack_rtt',
            availability: 'MEASURED',
            count: 2,
            errors: 2,
            errorRate: 1,
          },
        ])}
      />,
    );
    expect(screen.getByText('Сбор не подключён')).toBeInTheDocument();
    expect(screen.getByText('Нет замеров за период')).toBeInTheDocument();
    const acknowledgement = screen
      .getByRole('heading', { name: 'Сообщение · подтверждение' })
      .closest('article')!;
    expect(within(acknowledgement).getByText('— / — мс')).toBeInTheDocument();
    expect(within(acknowledgement).getByText('2 (100%)')).toBeInTheDocument();
    expect(
      within(acknowledgement).getByText(
        'Есть исходы операций, но задержка не измерена.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it.each([
    ['UNKNOWN', 'проверка источника ещё не выполнена'],
    ['STALE', 'данные источника устарели'],
    ['UNAVAILABLE', 'не удалось обновить источник'],
  ])(
    'explains %s separately and retains measured historical data',
    (status, text) => {
      render(
        <ProcessMetricsPanel
          snapshot={{
            ...snapshot([
              {
                ...empty,
                id: 'login.server',
                source: 'auth-service',
                availability: 'MEASURED',
                count: 1,
                durationSamples: 1,
                p50Ms: 50,
                p95Ms: 100,
              },
            ]),
            sources: {
              auth: {
                status,
                checkedAt: null,
                lastSuccessAt: '2026-10-08T09:55:00Z',
              },
            },
          }}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(text);
      expect(screen.getByRole('status')).toHaveTextContent('История сохранена');
      expect(screen.getByText('50 / 100 мс')).toBeInTheDocument();
    },
  );
});
