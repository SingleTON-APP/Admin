import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueueFilters } from './QueueFilters';

describe('QueueFilters', () => {
  it('keeps filters usable before counts arrive and clears implicit personal view', () => {
    const onChange = vi.fn();
    render(
      <QueueFilters
        params={new URLSearchParams('assignee=me')}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: /Моя очередь/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /Все/ }));
    expect(onChange).toHaveBeenCalledWith({ view: '', assignee: '' });
    expect(screen.getByLabelText('Тип объекта')).toBeVisible();
  });
  it('updates search draft when navigating between URL searches', () => {
    const onChange = vi.fn();
    const view = render(
      <QueueFilters
        params={new URLSearchParams('search=first')}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Поиск жалоб'), {
      target: { value: 'unsaved draft' },
    });
    view.rerender(
      <QueueFilters
        params={new URLSearchParams('search=second')}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('Поиск жалоб')).toHaveValue('second');
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(onChange).toHaveBeenCalledWith({ search: 'second' });
  });
  it('clears an unsubmitted draft on reset', () => {
    render(<QueueFilters params={new URLSearchParams()} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Поиск жалоб'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(screen.getByLabelText('Поиск жалоб')).toHaveValue('');
  });
  it('reconciles preset and assignee filters and exposes direction', () => {
    const onChange = vi.fn();
    render(
      <QueueFilters
        params={new URLSearchParams('view=mine')}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Исполнитель'), {
      target: { value: 'unassigned' },
    });
    expect(onChange).toHaveBeenCalledWith({ assignee: 'unassigned', view: '' });
    fireEvent.click(screen.getByRole('button', { name: /Критичные/ }));
    expect(onChange).toHaveBeenCalledWith({
      view: 'critical',
      assignee: '',
      status: '',
      priority: '',
    });
    fireEvent.change(screen.getByLabelText('Направление сортировки'), {
      target: { value: 'asc' },
    });
    expect(onChange).toHaveBeenCalledWith({ order: 'asc' });
    expect(screen.getByRole('option', { name: 'Комментарий' })).toHaveValue(
      'COMMENT',
    );
  });
});
