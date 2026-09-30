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
  it('keeps extended context unavailable to a moderator', () => {
    render(
      <ContextLevelSwitcher
        active={null}
        role="MODERATOR"
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Расширенный' }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Только объект' }));
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
