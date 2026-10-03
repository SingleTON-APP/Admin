import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../../types/domain';
import { AuditEventDetails } from './AuditEventDetails';
import { auditActionLabel } from '../../types/audit-labels';

const event: AuditEvent = {
  id: 'audit-1',
  timestamp: '2026-10-03T12:00:00Z',
  staff: null,
  action: 'REPORT_CONTENT_VIEWED',
  targetType: 'REPORT',
  targetId: 'report-1',
  reason: 'Проверка жалобы',
  result: 'DENIED',
  metadata: {
    level: 'EXTENDED',
    body: 'PRIVATE_MESSAGE_MUST_NOT_RENDER',
    password: 'PRIVATE_SECRET_MUST_NOT_RENDER',
  },
};

describe('audit event details', () => {
  it('treats prototype property names as unknown codes instead of rendering objects', () => {
    expect(auditActionLabel('__proto__')).toBe('Служебное действие');
    render(
      <AuditEventDetails
        event={{
          ...event,
          result: 'constructor',
          metadata: { level: '__proto__' },
        }}
      />,
    );
    expect(screen.getByText('Неизвестный результат')).toBeInTheDocument();
    expect(screen.queryByText(/Доступ:/)).not.toBeInTheDocument();
  });
  it('shows denied context access and its level without exposing arbitrary metadata', () => {
    render(<AuditEventDetails event={event} />);
    expect(screen.getByText('Просмотр контекста')).toBeInTheDocument();
    expect(screen.getByText('Отказано')).toHaveClass('status-danger');
    expect(
      screen.getByText('Доступ: Расширенный контекст'),
    ).toBeInTheDocument();
    expect(screen.getByText('Проверка жалобы')).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE_/)).not.toBeInTheDocument();
  });
  it('identifies staff access events and pending result honestly', () => {
    render(
      <AuditEventDetails
        event={{
          ...event,
          action: 'ADMIN_ACCOUNT_UPDATED',
          result: 'PENDING',
          metadata: { level: 'EXTENDED' },
        }}
      />,
    );
    expect(screen.getByText('Изменён доступ сотрудника')).toBeInTheDocument();
    expect(screen.getByText('Ожидает сверки')).toHaveClass('status-warning');
    expect(screen.queryByText(/Доступ:/)).not.toBeInTheDocument();
  });
  it('keeps unknown actions inspectable and does not manufacture a success result', () => {
    render(
      <AuditEventDetails
        event={{
          ...event,
          action: 'FUTURE_OPERATION',
          result: 'FUTURE_RESULT',
          metadata: { level: 'UNKNOWN_LEVEL' },
        }}
      />,
    );
    expect(screen.getByText('Служебное действие')).toHaveAttribute(
      'title',
      'FUTURE_OPERATION',
    );
    expect(screen.getByText('Неизвестный результат')).toHaveClass(
      'status-neutral',
    );
    expect(screen.queryByText(/Доступ:/)).not.toBeInTheDocument();
  });
});
