import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminContext } from '../../features/admin-access/AdminContext';
import * as service from '../../services/global-search.service';
import { GlobalSearch } from './GlobalSearch';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('debounces requests, cancels stale searches and opens the chosen result', async () => {
  let resolveFirst!: (groups: service.SearchGroup[]) => void;
  const search = vi
    .spyOn(service, 'globalSearch')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValue([
      {
        label: 'Новости',
        items: [
          {
            title: 'Свежая новость',
            detail: 'Черновик',
            path: '/admin/site/news?article=5',
          },
        ],
      },
    ]);
  const onClose = vi.fn();
  render(
    <AdminContext.Provider
      value={{
        id: '1',
        publicId: 'root',
        name: 'Root',
        email: '',
        role: 'FULL_ADMIN',
      }}
    >
      <MemoryRouter>
        <GlobalSearch onClose={onClose} />
      </MemoryRouter>
    </AdminContext.Provider>,
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'старая' } });
  act(() => vi.advanceTimersByTime(249));
  expect(search).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(1));
  fireEvent.change(input, { target: { value: 'свежая' } });
  expect(search.mock.calls[0]?.[2].aborted).toBe(true);
  await act(async () => vi.advanceTimersByTime(250));
  await act(async () =>
    resolveFirst([
      {
        label: 'Новости',
        items: [{ title: 'Устаревшая новость', detail: '', path: '/old' }],
      },
    ]),
  );
  expect(screen.queryByText('Устаревшая новость')).not.toBeInTheDocument();
  const result = screen.getByRole('link', { name: /Свежая новость/ });
  expect(result).toHaveAttribute('href', '/admin/site/news?article=5');
  fireEvent.click(result);
  expect(onClose).toHaveBeenCalledOnce();
});
