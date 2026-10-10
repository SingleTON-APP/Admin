import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AdminContext } from '../features/admin-access/AdminContext';
import { siteContentService } from '../services/site-content.service';
import type { SiteNewsItem } from '../types/site-content';
import { SiteNewsPage } from './SiteNewsPage';

const item: SiteNewsItem = {
  id: 42,
  title: 'Проверяемая новость',
  description: 'Описание публикации',
  date: '10 окт.',
  image: null,
  content: '<p>Текст статьи</p>',
  created_at: '2026-10-10 10:00:00',
  updated_at: '2026-10-10 10:00:00',
};
function mount(role: 'FULL_ADMIN' | 'MODERATOR' = 'FULL_ADMIN') {
  return render(
    <AdminContext.Provider
      value={{ id: 'admin-1', publicId: 'root', name: 'Root', email: '', role }}
    >
      <RouterProvider
        router={createMemoryRouter([{ path: '*', element: <SiteNewsPage /> }], {
          initialEntries: ['/admin/site/news'],
        })}
      />
    </AdminContext.Provider>,
  );
}
async function openDelete() {
  mount();
  await screen.findByRole('button', { name: `Удалить ${item.title}` });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  fireEvent.click(
    screen.getByRole('button', { name: `Удалить ${item.title}` }),
  );
  return within(screen.getByRole('dialog'));
}
beforeEach(() => {
  vi.spyOn(siteContentService, 'list').mockResolvedValue([item]);
  vi.spyOn(siteContentService, 'remove').mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('site news publishing and deletion', () => {
  it('autosaves incomplete news to the server and preserves typing while saving', async () => {
    let resolveSave!: (value: SiteNewsItem) => void;
    const autosave = vi
      .spyOn(siteContentService, 'saveDraft')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          }),
      )
      .mockResolvedValue({
        ...item,
        id: 44,
        title: 'Продолжение',
        status: 'DRAFT',
        revision: 2,
      });
    mount();
    await screen.findByRole('button', { name: `Удалить ${item.title}` });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.change(screen.getByLabelText('Заголовок статьи'), {
      target: { value: 'Начало' },
    });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(autosave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Начало', description: '' }),
      expect.any(String),
      null,
    );
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Заголовок статьи'), {
      target: { value: 'Продолжение' },
    });
    await act(async () =>
      resolveSave({
        ...item,
        id: 44,
        title: 'Начало',
        description: '',
        status: 'DRAFT',
        revision: 1,
      }),
    );
    expect(screen.getByLabelText('Заголовок статьи')).toHaveValue(
      'Продолжение',
    );
    await act(async () => vi.advanceTimersByTime(1000));
    expect(autosave).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Продолжение' }),
      expect.any(String),
      expect.objectContaining({ id: 44, revision: 1 }),
    );
    expect(
      screen.getByText('Черновик сохранён на сервере. На сайте его ещё нет.'),
    ).toBeInTheDocument();
  });

  it('keeps unsaved text on conflict and retries only after an explicit request', async () => {
    const autosave = vi
      .spyOn(siteContentService, 'saveDraft')
      .mockRejectedValue(new Error('Конфликт версий'));
    mount();
    await screen.findByRole('button', { name: `Удалить ${item.title}` });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.change(screen.getByLabelText('Заголовок статьи'), {
      target: { value: 'Мой текст' },
    });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Конфликт версий')).toBeInTheDocument();
    expect(screen.getByLabelText('Заголовок статьи')).toHaveValue('Мой текст');
    await act(async () => vi.advanceTimersByTime(10000));
    expect(autosave).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Повторить сохранение' }),
    );
    await act(async () => vi.advanceTimersByTime(1000));
    expect(autosave).toHaveBeenCalledTimes(2);
    expect(autosave.mock.calls[0]?.[1]).toBe(autosave.mock.calls[1]?.[1]);
  });

  it('publishes a restored server draft using its revision', async () => {
    const savedDraft = { ...item, status: 'DRAFT' as const, revision: 7 };
    vi.mocked(siteContentService.list).mockResolvedValue([savedDraft]);
    const update = vi
      .spyOn(siteContentService, 'update')
      .mockResolvedValue({ ...item, status: 'PUBLISHED', revision: 8 });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: new RegExp('^' + item.title) }),
    );
    expect(screen.getByLabelText('Заголовок статьи')).toHaveValue(item.title);
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await screen.findByText('Новость опубликована');
    expect(update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ title: item.title }),
      7,
    );
  });

  it('publishes the draft and keeps the returned article selected without a second list request', async () => {
    const create = vi
      .spyOn(siteContentService, 'create')
      .mockResolvedValue({ ...item, id: 43, title: 'Новая статья' });
    const update = vi
      .spyOn(siteContentService, 'update')
      .mockResolvedValue({ ...item, id: 43, title: 'Новая статья' });
    mount();
    await screen.findByRole('button', { name: `Удалить ${item.title}` });
    fireEvent.change(screen.getByLabelText('Заголовок статьи'), {
      target: { value: 'Новая статья' },
    });
    fireEvent.change(screen.getByLabelText('Краткое описание'), {
      target: { value: 'Описание' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await screen.findByText('Новость опубликована');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Новая статья',
        description: 'Описание',
      }),
    );
    expect(siteContentService.list).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Статья #43')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );
    await screen.findByText('Изменения сохранены');
    expect(update).toHaveBeenCalledWith(43, expect.anything(), undefined);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('shows creation errors without claiming publication or losing the draft', async () => {
    vi.spyOn(siteContentService, 'create').mockRejectedValue(
      new Error('Сервис недоступен'),
    );
    mount();
    await screen.findByRole('button', { name: `Удалить ${item.title}` });
    fireEvent.change(screen.getByLabelText('Заголовок статьи'), {
      target: { value: 'Не терять черновик' },
    });
    fireEvent.change(screen.getByLabelText('Краткое описание'), {
      target: { value: 'Описание' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('Новость опубликована')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Заголовок статьи')).toHaveValue(
      'Не терять черновик',
    );
  });

  it('waits a full five seconds and still requires an explicit deletion click', async () => {
    const dialog = await openDelete();
    expect(dialog.getByText(item.title)).toBeInTheDocument();
    fireEvent.click(
      dialog.getByRole('button', { name: 'Удалить через 5 сек.' }),
    );
    act(() => vi.advanceTimersByTime(4900));
    expect(
      dialog.getByRole('button', { name: 'Удалить через 1 сек.' }),
    ).toBeDisabled();
    expect(siteContentService.remove).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(
      dialog.getByRole('button', { name: 'Удалить навсегда' }),
    ).toBeEnabled();
    expect(siteContentService.remove).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.click(dialog.getByRole('button', { name: 'Удалить навсегда' })),
    );
    expect(siteContentService.remove).toHaveBeenCalledExactlyOnceWith(42);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Удалить ${item.title}` }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Новость удалена')).toBeInTheDocument();
  });

  it('cancels without deleting and restarts the countdown on reopening', async () => {
    const dialog = await openDelete();
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(dialog.getByRole('button', { name: 'Отмена' }));
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить ${item.title}` }),
    );
    expect(
      screen.getByRole('button', { name: 'Удалить через 5 сек.' }),
    ).toBeDisabled();
    expect(siteContentService.remove).not.toHaveBeenCalled();
  });

  it('keeps the dialog and article when deletion fails, then permits retry', async () => {
    vi.mocked(siteContentService.remove).mockRejectedValueOnce(
      new Error('Не удалось удалить новость'),
    );
    const dialog = await openDelete();
    act(() => vi.advanceTimersByTime(5000));
    await act(async () =>
      fireEvent.click(dialog.getByRole('button', { name: 'Удалить навсегда' })),
    );
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'Не удалось удалить новость',
    );
    expect(
      screen.getByRole('button', { name: `Удалить ${item.title}` }),
    ).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(dialog.getByRole('button', { name: 'Удалить навсегда' })),
    );
    expect(siteContentService.remove).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not expose website mutations to moderators', () => {
    mount('MODERATOR');
    expect(
      screen.getByText(/Для управления сайтом нужна роль администратора/),
    ).toBeInTheDocument();
    expect(siteContentService.list).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Опубликовать' }),
    ).not.toBeInTheDocument();
  });
});
