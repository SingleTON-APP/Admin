import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../components/notifications/Notifications';
import { Dialog } from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/Primitives';
import { useAsync } from '../hooks/useAsync';
import {
  notificationsService,
  type AdminNotification,
} from '../services/notifications.service';
import { useAdmin } from '../features/admin-access/AdminContext';

export function NotificationsPage() {
  const latest = useNotifications();
  const admin = useAdmin();
  const [cursor, setCursor] = useState<string>();
  const [revision, setRevision] = useState(0);
  const history = useAsync(
    (signal) =>
      cursor
        ? notificationsService.list(signal, cursor)
        : Promise.resolve(undefined),
    [cursor, revision],
  );
  const page = cursor ? history.data : latest.data;
  const items = page?.items.filter(
    (item) => admin.role !== 'MODERATOR' || item.kind !== 'SECURITY',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [closing, setClosing] = useState<AdminNotification | null>(null);
  const [reason, setReason] = useState('');
  const update = async (action: () => Promise<unknown>) => {
    setPending(true);
    setError(undefined);
    try {
      await action();
      latest.refresh();
      setRevision((value) => value + 1);
      setClosing(null);
      setReason('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось выполнить действие',
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="События и инциденты"
        title="Уведомления"
        description="Прочтение персональное. Системный инцидент закрывается после восстановления сервиса."
        actions={
          <button
            className="button secondary"
            disabled={pending || !items?.some((item) => !item.read)}
            onClick={() =>
              void update(() => notificationsService.readShown(items!))
            }
          >
            Прочитать показанные
          </button>
        }
      />
      {(error || latest.error || history.error) && (
        <p role="alert" className="state-error">
          {error || latest.error || history.error}
        </p>
      )}
      {!page && (latest.loading || history.loading) && (
        <p role="status">Загрузка уведомлений…</p>
      )}
      {items?.length === 0 && (
        <section className="card">
          <p>Уведомлений пока нет.</p>
        </section>
      )}
      <div className="notification-history">
        {items?.map((item) => (
          <article
            key={item.id}
            className={`card notification-event ${item.read ? '' : 'is-unread'}`}
          >
            <header>
              <div>
                <small>
                  {item.kind === 'SECURITY'
                    ? 'Безопасность'
                    : 'Состояние сервисов'}{' '}
                  · {item.resolvedAt ? 'Закрыто' : 'Открыто'}
                </small>
                <h2>{item.title}</h2>
              </div>
              <time dateTime={item.updatedAt}>
                {new Date(item.updatedAt).toLocaleString('ru-RU')}
              </time>
            </header>
            <p>{item.message}</p>
            <dl className="notification-facts">
              <div>
                <dt>Первое событие</dt>
                <dd>{new Date(item.createdAt).toLocaleString('ru-RU')}</dd>
              </div>
              <div>
                <dt>Повторений</dt>
                <dd>{item.occurrences}</dd>
              </div>
              {item.kind === 'SECURITY' && (
                <>
                  <div>
                    <dt>Этап входа</dt>
                    <dd>
                      {item.metadata.stage === 'GATE'
                        ? 'Общий пароль'
                        : 'Личный пароль'}
                    </dd>
                  </div>
                  <div>
                    <dt>IP</dt>
                    <dd>{item.metadata.ip || 'Не определён'}</dd>
                  </div>
                  {item.metadata.username && (
                    <div>
                      <dt>Введённый логин</dt>
                      <dd>{item.metadata.username}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Ошибочных попыток</dt>
                    <dd>{item.metadata.attempts ?? '—'}</dd>
                  </div>
                  {item.metadata.blockedUntil && (
                    <div>
                      <dt>Блокировка до</dt>
                      <dd>
                        {new Date(item.metadata.blockedUntil).toLocaleString(
                          'ru-RU',
                        )}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            <footer>
              {!item.read && (
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() =>
                    void update(() => notificationsService.read(item))
                  }
                >
                  Отметить прочитанным
                </button>
              )}
              {item.kind === 'SECURITY' && !item.resolvedAt && (
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => setClosing(item)}
                >
                  Закрыть инцидент
                </button>
              )}
              {item.kind === 'SERVICE' && (
                <Link className="button ghost" to="/admin/system">
                  Состояние сервисов
                </Link>
              )}
            </footer>
          </article>
        ))}
      </div>
      <div className="pagination">
        <button
          className="button secondary"
          disabled={!cursor || pending}
          onClick={() => setCursor(undefined)}
        >
          К новым событиям
        </button>
        <button
          className="button secondary"
          disabled={!page?.nextCursor || pending}
          onClick={() => setCursor(page?.nextCursor ?? undefined)}
        >
          Более ранние
        </button>
      </div>
      <Dialog
        open={!!closing}
        title="Закрыть инцидент безопасности"
        onClose={() => {
          if (!pending) setClosing(null);
        }}
        dismissDisabled={pending}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (closing)
              void update(() =>
                notificationsService.resolve(closing.id, reason.trim()),
              );
          }}
        >
          <p>
            Закрытие увидят остальные администраторы. Действие будет записано в
            журнал; действующая блокировка входа сохранится.
          </p>
          <label>
            Причина закрытия
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            className="button primary"
            disabled={pending || reason.trim().length < 10}
          >
            Закрыть инцидент
          </button>
        </form>
      </Dialog>
    </>
  );
}
