import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HelpPage } from './HelpPage';

describe('searchable administration help', () => {
  it('searches answers as well as questions and opens matching answers', () => {
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>,
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Поиск по вопросам и ответам' }),
      { target: { value: 'p95' } },
    );
    expect(screen.getByRole('status')).toHaveTextContent('Найдено вопросов: 1');
    expect(screen.getByText(/p95 — значение/)).toBeVisible();
    expect(
      screen.queryByText('Кто видит уведомления о неверных паролях?'),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'несогласованное-несуществующее-слово' },
    });
    expect(
      screen.getByRole('heading', { name: 'Ничего не найдено' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Найдено вопросов: 21',
    );
  });
  it('explains privacy requirements and separates delivery from reading', () => {
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'прочтение' },
    });
    expect(screen.getByText(/Прочтение — отдельное действие/)).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'не короче 10 символов' },
    });
    expect(
      screen.getByText(/Дополнительный контекст.*ADMIN и FULL_ADMIN/),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Открыть мониторинг' }),
    ).toHaveAttribute('href', '/admin/monitor');
  });
});
