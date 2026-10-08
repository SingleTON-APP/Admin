import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { adminService } from '../../services/admin.service';
import type { Report, StaffIdentity } from '../../types/domain';
import { ActionPanel } from './ActionPanel';
import {
  CommentBranch,
  ContextLevelSwitcher,
  MessageRow,
  ModerationContextViewer,
  PostCard,
} from './ModerationContextViewer';

const moderator: StaffIdentity = {
  id: 'staff-1',
  publicId: 'mod-1',
  name: 'Модератор',
  email: 'mod@example.test',
  role: 'MODERATOR',
};

const report: Report = {
  id: 'report-1',
  targetType: 'POST',
  targetId: 'post-1',
  messageId: null,
  chatId: null,
  reason: 'Спам',
  category: 'SPAM',
  priority: 'HIGH',
  sourceContextId: null,
  status: 'OPEN',
  resolutionReason: null,
  resolvedAt: null,
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
  reporter: null,
  targetUser: null,
  assignee: null,
};

describe('moderation context', () => {
  it('requires explicit justification before extended disclosure', () => {
    const onSelect = vi.fn();
    render(
      <ContextLevelSwitcher active={null} role="ADMIN" onSelect={onSelect} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Дополнительный контекст' }),
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Запросить доступ' }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Основание'), {
      target: { value: 'Проверка повторных нарушений' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Запросить доступ' }));
    expect(onSelect).toHaveBeenCalledWith(
      'EXTENDED',
      'Проверка повторных нарушений',
    );
  });
  it('keeps extended context unavailable to a moderator', () => {
    render(
      <ContextLevelSwitcher
        active={null}
        role="MODERATOR"
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Дополнительный контекст' }),
    ).not.toBeInTheDocument();
  });

  it('shows the empty, loading and error states', async () => {
    let rejectRequest!: (reason: Error) => void;
    vi.spyOn(adminService, 'reportContext').mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    render(<ModerationContextViewer reportId="report-1" role="ADMIN" />);
    expect(
      screen.getByText('Приватный контент не загружен'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Содержимое жалобы' }));
    expect(screen.getByText('Загрузка данных…')).toBeInTheDocument();
    rejectRequest(new Error('Контекст недоступен'));
    await waitFor(() =>
      expect(screen.getByText(/Контекст недоступен/)).toBeInTheDocument(),
    );
  });

  it('renders message, post and comment targets safely', () => {
    const { rerender } = render(
      <MessageRow message={{ id: 'm1', deleted: true }} reported />,
    );
    expect(screen.getByText('Сообщение удалено')).toBeInTheDocument();
    rerender(
      <PostCard
        post={{
          id: 'p1',
          body: 'Пост',
          author: null,
          createdAt: '2026-09-30T10:00:00Z',
          deleted: false,
        }}
      />,
    );
    expect(screen.getByText('Пост')).toBeInTheDocument();
    rerender(
      <CommentBranch
        context={{
          kind: 'COMMENT',
          appliedLevel: 'NEARBY',
          post: {
            id: 'p1',
            body: null,
            author: null,
            createdAt: '2026-09-30T10:00:00Z',
            deleted: false,
          },
          parents: [],
          siblings: [],
          children: [],
          target: {
            id: 'c1',
            postId: 'p1',
            body: null,
            author: null,
            createdAt: '2026-09-30T10:00:00Z',
            deleted: true,
          },
        }}
      />,
    );
    expect(
      screen.getByText('Комментарий удалён (ветка сохранена)'),
    ).toBeInTheDocument();
  });
});

describe('moderation actions', () => {
  it('names the exact user in a sanction confirmation', () => {
    render(
      <ActionPanel
        report={{
          ...report,
          targetUser: {
            id: 'actual-user-id',
            publicId: 'public-user-id',
            username: 'subject',
            firstName: 'Имя',
            lastName: '',
            avatar: null,
            role: 'USER',
          },
        }}
        admin={moderator}
        staff={[]}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Временная блокировка' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('actual-user-id');
    expect(dialog).toHaveTextContent('@subject');
    expect(dialog).not.toHaveTextContent('post-1');
  });
  it('preserves the operation key when a destructive request is retried', async () => {
    const operation = vi
      .spyOn(adminService, 'moderateReportTarget')
      .mockRejectedValueOnce(new Error('Сеть недоступна'))
      .mockResolvedValueOnce({});
    render(
      <ActionPanel
        report={report}
        admin={moderator}
        staff={[]}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть пост' }));
    fireEvent.change(screen.getByLabelText('Причина'), {
      target: { value: 'Подтверждённое нарушение правил' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await screen.findByText('Сеть недоступна');
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await waitFor(() => expect(operation).toHaveBeenCalledTimes(2));
    expect(operation.mock.calls[0]?.[4]).toBeTruthy();
    expect(operation.mock.calls[1]?.[4]).toBe(operation.mock.calls[0]?.[4]);
  });
  it('hides forbidden destructive actions and requires confirmation', () => {
    const { unmount } = render(
      <ActionPanel
        report={report}
        admin={moderator}
        staff={[]}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Удалить пост' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть пост' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Точная цель');
    expect(screen.getByRole('dialog')).toHaveTextContent('post-1');
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeDisabled();
    unmount();

    render(
      <ActionPanel
        report={{ ...report, targetType: 'COMMENT', targetId: 'comment-1' }}
        admin={{ ...moderator, role: 'ADMIN' }}
        staff={[]}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Удалить комментарий' }),
    ).toBeInTheDocument();
  });
});
