import { useState, type FormEvent } from 'react';
import {
  adminService,
  type ModerationAction,
} from '../../services/admin.service';
import type {
  Report,
  ReportPriority,
  StaffIdentity,
  StaffSummary,
} from '../../types/domain';
import { Dialog } from '../ui/Dialog';

type Pending =
  | {
      kind: 'action';
      action: ModerationAction;
      label: string;
      durationDays?: number;
      idempotencyKey: string;
    }
  | { kind: 'status'; status: 'RESOLVED' | 'REJECTED'; label: string };

export function ActionPanel({
  report,
  admin,
  staff,
  onChanged,
}: {
  report: Report;
  admin: StaffIdentity;
  staff: StaffSummary[];
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const run = async (key: string, operation: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(key);
    setResult(null);
    try {
      await operation();
      setResult({ tone: 'success', text: 'Действие выполнено' });
      onChanged();
      return true;
    } catch (error) {
      setResult({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Ошибка выполнения',
      });
      return false;
    } finally {
      setBusy('');
    }
  };
  const submitConfirmation = async (event: FormEvent) => {
    event.preventDefault();
    if (!pending || reason.trim().length < 10) return;
    const value = pending;
    const succeeded = await run('confirmation', () =>
      value.kind === 'action'
        ? adminService.moderateReportTarget(
            report.id,
            value.action,
            reason.trim(),
            value.durationDays,
            value.idempotencyKey,
          )
        : adminService.updateReportStatus(
            report.id,
            value.status,
            reason.trim(),
          ),
    );
    if (succeeded) {
      setPending(null);
      setReason('');
    }
  };
  const targetActions: Array<{
    action: ModerationAction;
    label: string;
    roles?: Array<StaffIdentity['role']>;
  }> =
    report.targetType === 'MESSAGE'
      ? [{ action: 'DELETE_MESSAGE', label: 'Удалить сообщение' }]
      : report.targetType === 'POST'
        ? [
            { action: 'HIDE_POST', label: 'Скрыть пост' },
            {
              action: 'DELETE_POST',
              label: 'Удалить пост',
              roles: ['ADMIN', 'FULL_ADMIN'],
            },
          ]
        : report.targetType === 'COMMENT'
          ? [
              { action: 'HIDE_COMMENT', label: 'Скрыть комментарий' },
              {
                action: 'DELETE_COMMENT',
                label: 'Удалить комментарий',
                roles: ['ADMIN', 'FULL_ADMIN'],
              },
            ]
          : [];
  return (
    <section className="card action-panel">
      <div className="card-head">
        <h2>Действия</h2>
      </div>
      {result && (
        <p
          className={
            result.tone === 'error' ? 'action-result error' : 'action-result'
          }
          role="status"
        >
          {result.text}
        </p>
      )}
      {report.status === 'OPEN' && (
        <button
          className="button primary full-width"
          disabled={!!busy}
          onClick={() =>
            void run('take', () => adminService.takeReport(report.id))
          }
        >
          {busy === 'take' ? 'Выполняется…' : 'Взять в работу'}
        </button>
      )}
      <label className="form-label">
        Исполнитель
        <select
          value={report.assignee?.id ?? ''}
          disabled={!!busy || admin.role === 'MODERATOR'}
          onChange={(event) =>
            void run('assign', () =>
              adminService.assignReport(report.id, event.target.value),
            )
          }
        >
          <option value="">Не назначен</option>
          {staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Приоритет
        <select
          value={report.priority}
          disabled={!!busy}
          onChange={(event) =>
            void run('priority', () =>
              adminService.updateReportPriority(
                report.id,
                event.target.value as ReportPriority,
              ),
            )
          }
        >
          {(
            ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] satisfies ReportPriority[]
          ).map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <div className="action-group">
        <h3>Контент</h3>
        {targetActions
          .filter((item) => !item.roles || item.roles.includes(admin.role))
          .map((item) => (
            <button
              key={item.action}
              className="button danger full-width"
              disabled={!!busy}
              onClick={() =>
                setPending({
                  kind: 'action',
                  action: item.action,
                  label: item.label,
                  idempotencyKey: crypto.randomUUID(),
                })
              }
            >
              {item.label}
            </button>
          ))}
        {!targetActions.length && (
          <p className="data-note">
            Для этого типа цели нет действий с контентом.
          </p>
        )}
      </div>
      {report.targetUser && (
        <div className="action-group">
          <h3>Пользователь</h3>
          <button
            className="button secondary full-width"
            disabled={!!busy}
            onClick={() =>
              setPending({
                kind: 'action',
                action: 'TEMP_BAN_USER',
                label: 'Заблокировать на 7 дней',
                durationDays: 7,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            Временная блокировка
          </button>
          {(admin.role === 'ADMIN' || admin.role === 'FULL_ADMIN') && (
            <button
              className="button danger full-width"
              disabled={!!busy}
              onClick={() =>
                setPending({
                  kind: 'action',
                  action: 'PERMANENT_BAN_USER',
                  label: 'Заблокировать навсегда',
                  idempotencyKey: crypto.randomUUID(),
                })
              }
            >
              Постоянная блокировка
            </button>
          )}
        </div>
      )}
      <div className="action-group">
        <h3>Решение</h3>
        <button
          className="button secondary full-width"
          disabled={!!busy || report.status === 'REJECTED'}
          onClick={() =>
            setPending({
              kind: 'status',
              status: 'REJECTED',
              label: 'Отклонить жалобу',
            })
          }
        >
          Нарушения нет / отклонить
        </button>
        <button
          className="button primary full-width"
          disabled={!!busy || report.status === 'RESOLVED'}
          onClick={() =>
            setPending({
              kind: 'status',
              status: 'RESOLVED',
              label: 'Завершить жалобу',
            })
          }
        >
          Завершить жалобу
        </button>
      </div>
      <form
        className="internal-note"
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) return;
          void run('note', () =>
            adminService.addReportNote(report.id, note.trim()),
          ).then((succeeded) => {
            if (succeeded) setNote('');
          });
        }}
      >
        <label className="form-label">
          Внутренний комментарий
          <textarea
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Виден только сотрудникам"
          />
        </label>
        <button
          className="button secondary full-width"
          disabled={!!busy || !note.trim()}
        >
          {busy === 'note' ? 'Сохранение…' : 'Добавить комментарий'}
        </button>
      </form>
      <Dialog
        open={!!pending}
        title={pending?.label ?? 'Подтверждение'}
        onClose={() => {
          if (!busy) {
            setPending(null);
            setReason('');
          }
        }}
      >
        <form
          className="form-stack"
          onSubmit={(event) => void submitConfirmation(event)}
        >
          <div className="confirmation-target">
            <span>Точная цель</span>
            <strong>
              {pending?.kind === 'action' &&
              ['TEMP_BAN_USER', 'PERMANENT_BAN_USER'].includes(pending.action)
                ? 'Пользователь'
                : report.targetType}
            </strong>
            <code>
              {pending?.kind === 'action' &&
              ['TEMP_BAN_USER', 'PERMANENT_BAN_USER'].includes(pending.action)
                ? report.targetUser?.id
                : report.targetId}
            </code>
            {pending?.kind === 'action' &&
              ['TEMP_BAN_USER', 'PERMANENT_BAN_USER'].includes(
                pending.action,
              ) &&
              report.targetUser?.username && (
                <span>@{report.targetUser.username}</span>
              )}
          </div>
          <label>
            Причина
            <textarea
              required
              minLength={10}
              maxLength={1000}
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Минимум 10 символов"
            />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              disabled={!!busy}
              onClick={() => {
                setPending(null);
                setReason('');
              }}
            >
              Отмена
            </button>
            <button
              className="button danger"
              disabled={!!busy || reason.trim().length < 10}
            >
              {busy ? 'Выполняется…' : 'Подтвердить'}
            </button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
