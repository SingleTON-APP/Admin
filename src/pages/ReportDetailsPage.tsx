import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Dialog } from '../components/ui/Dialog';
import {
  ErrorState,
  IDDisplay,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import type { ReportStatus } from '../types/domain';

export function ReportDetailsPage() {
  const admin = useAdmin();
  const { id = '' } = useParams();
  const [reload, setReload] = useState(0);
  const [nextStatus, setNextStatus] = useState<Extract<
    ReportStatus,
    'RESOLVED' | 'REJECTED'
  > | null>(null);
  const [failure, setFailure] = useState('');
  const state = useAsync(
    (signal) => adminService.report(id, signal),
    [id, reload],
  );
  const staffState = useAsync(
    (signal) =>
      admin.role === 'MODERATOR'
        ? Promise.resolve([])
        : adminService.staff(signal),
    [admin.role],
  );
  if (state.loading) return <LoadingState />;
  if (state.error || !state.data)
    return <ErrorState message={state.error ?? 'Жалоба не найдена'} />;
  const report = state.data;
  const open = report.status === 'OPEN' || report.status === 'IN_REVIEW';
  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nextStatus) return;
    const reason = String(new FormData(event.currentTarget).get('reason'));
    try {
      await adminService.updateReport(report.id, nextStatus, reason);
      setNextStatus(null);
      setReload((value) => value + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Ошибка');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Жалоба"
        title={`Жалоба ${report.id.slice(0, 8)}`}
        description={`Создана ${new Date(report.createdAt).toLocaleString('ru-RU')}`}
        actions={
          <Link className="button secondary" to="/admin/reports">
            К очереди
          </Link>
        }
      />
      <div className="two-column">
        <section className="card tab-content">
          <div className="card-head">
            <h2>Данные жалобы</h2>
            <StatusBadge value={report.status.replace('_', ' ')} />
          </div>
          <dl className="details-list">
            <div>
              <dt>Тип объекта</dt>
              <dd>{report.targetType}</dd>
            </div>
            <div>
              <dt>Причина</dt>
              <dd>{report.reason}</dd>
            </div>
            <div>
              <dt>Заявитель</dt>
              <dd>
                {report.reporter ? (
                  <Link to={`/admin/users/${report.reporter.publicId}`}>
                    @{report.reporter.username}
                  </Link>
                ) : (
                  'Удалён'
                )}
              </dd>
            </div>
            <div>
              <dt>Пользователь</dt>
              <dd>
                <Link to={`/admin/users/${report.targetUser.publicId}`}>
                  @{report.targetUser.username}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Исполнитель</dt>
              <dd>{report.assignee?.name || 'Не назначен'}</dd>
            </div>
          </dl>
        </section>
        <section className="card tab-content">
          <div className="card-head">
            <h2>Метаданные объекта</h2>
          </div>
          {report.message ? (
            <dl className="details-list">
              <div>
                <dt>ID сообщения</dt>
                <dd>
                  <IDDisplay value={report.message.id} />
                </dd>
              </div>
              {report.message.senderId && (
                <div>
                  <dt>ID отправителя</dt>
                  <dd>
                    <IDDisplay value={report.message.senderId} />
                  </dd>
                </div>
              )}
              {report.message.chatId && (
                <div>
                  <dt>ID чата</dt>
                  <dd>
                    <IDDisplay value={report.message.chatId} />
                  </dd>
                </div>
              )}
              {report.message.createdAt && (
                <div>
                  <dt>Создано</dt>
                  <dd>
                    {new Date(report.message.createdAt).toLocaleString('ru-RU')}
                  </dd>
                </div>
              )}
              <div>
                <dt>Тип</dt>
                <dd>{report.message.messageType}</dd>
              </div>
              <div>
                <dt>Вложения</dt>
                <dd>{report.message.hasAttachments ? 'Есть' : 'Нет'}</dd>
              </div>
              <div>
                <dt>Жалобы</dt>
                <dd>{report.message.reportCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="data-note">Жалоба не связана с сообщением.</p>
          )}
          <p className="data-note">
            Содержимое сообщений недоступно сотрудникам панели.
          </p>
        </section>
      </div>
      {open && (
        <div className="moderation-actions">
          {admin.role !== 'MODERATOR' && (
            <select
              aria-label="Назначить исполнителя"
              value={report.assignee?.id ?? ''}
              disabled={staffState.loading}
              onChange={async (event) => {
                if (!event.target.value) return;
                await adminService.assignReport(report.id, event.target.value);
                setReload((value) => value + 1);
              }}
            >
              <option value="">Назначить исполнителя</option>
              {staffState.data?.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name || staff.email} · {staff.role}
                </option>
              ))}
            </select>
          )}
          {report.status === 'OPEN' && (
            <button
              className="button primary"
              onClick={async () => {
                await adminService.takeReport(report.id);
                setReload((value) => value + 1);
              }}
            >
              Взять в работу
            </button>
          )}
          {report.message && !report.message.deleted && (
            <button
              className="button danger"
              onClick={async () => {
                const reason = window.prompt('Причина удаления сообщения');
                if (!reason) return;
                await adminService.deleteMessage(report.message!.id, reason);
                setReload((value) => value + 1);
              }}
            >
              Удалить сообщение
            </button>
          )}
          <button
            className="button secondary"
            onClick={async () => {
              const reason = window.prompt('Причина временной блокировки');
              if (!reason) return;
              await adminService.sanction(report.targetUser.id, {
                type: 'TEMPORARY',
                durationDays: 7,
                reason,
              });
              setReload((value) => value + 1);
            }}
          >
            Блокировка на 7 дней
          </button>
          {admin.role !== 'MODERATOR' && (
            <button
              className="button danger"
              onClick={async () => {
                if (!window.confirm('Подтвердить постоянную блокировку?'))
                  return;
                const reason = window.prompt('Причина постоянной блокировки');
                if (!reason) return;
                await adminService.sanction(report.targetUser.id, {
                  type: 'PERMANENT',
                  reason,
                });
                setReload((value) => value + 1);
              }}
            >
              Постоянная блокировка
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => setNextStatus('REJECTED')}
          >
            Отклонить
          </button>
          <button
            className="button primary"
            onClick={() => setNextStatus('RESOLVED')}
          >
            Завершить
          </button>
        </div>
      )}
      <section className="card incidents">
        <div className="card-head">
          <h2>История обработки</h2>
        </div>
        {report.history.map((event) => (
          <div key={event.id}>
            <StatusBadge value={event.result} />
            <span>
              <strong>{event.action}</strong>
              <small>
                {event.staff?.name || 'Система'} ·{' '}
                {event.reason || 'Без комментария'}
              </small>
            </span>
            <span className="incident-date">
              {new Date(event.timestamp).toLocaleString('ru-RU')}
            </span>
          </div>
        ))}
      </section>
      <Dialog
        open={nextStatus !== null}
        title={
          nextStatus === 'RESOLVED' ? 'Завершить жалобу' : 'Отклонить жалобу'
        }
        onClose={() => setNextStatus(null)}
      >
        <form className="form-stack" onSubmit={close}>
          <label>
            Причина
            <textarea name="reason" required maxLength={1000} />
          </label>
          {failure && <p className="state-error">{failure}</p>}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setNextStatus(null)}
            >
              Отмена
            </button>
            <button className="button primary">Сохранить</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
