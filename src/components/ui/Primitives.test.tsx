import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IDDisplay } from './Primitives';
import { Dialog } from './Dialog';

describe('accessible utility controls', () => {
  it('reports success only after clipboard confirms the write', async () => {
    let finish!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<IDDisplay value="report-1234567890123456789" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Скопировано')).not.toBeInTheDocument();
    await act(async () => finish());
    expect(screen.getByText('Скопировано')).toBeInTheDocument();
  });

  it('keeps the full identifier available if clipboard access is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
    });
    render(<IDDisplay value="report-1234567890123456789" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(
        screen.getByText('report-1234567890123456789'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Скопировано')).not.toBeInTheDocument();
  });

  it('exposes the dialog title as its accessible name', () => {
    render(
      <Dialog open title="Подтвердить удаление" onClose={vi.fn()}>
        Точная цель
      </Dialog>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Подтвердить удаление' }),
    ).toBeInTheDocument();
  });
  it('prevents Escape from dismissing an operation in progress', () => {
    render(
      <Dialog open dismissDisabled title="Выполняется" onClose={vi.fn()}>
        Операция
      </Dialog>,
    );
    const event = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeDisabled();
  });
});
