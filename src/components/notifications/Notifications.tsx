import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../features/admin-access/AdminContext';
import { usePolling } from '../../hooks/usePolling';
import {
  notificationsService,
  type AdminNotification,
  type NotificationPage,
} from '../../services/notifications.service';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import '../../styles/notifications.css';

interface NotificationsState {
  data?: NotificationPage;
  error?: string;
  loading: boolean;
  refresh: () => void;
}
const Context = createContext<NotificationsState | null>(null);
export const useNotifications = () => {
  const value = useContext(Context);
  if (!value) throw new Error('Notifications are unavailable');
  return value;
};
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const admin = useAdmin();
  const seen = useRef<Map<string, number> | null>(null);
  const [toasts, setToasts] = useState<AdminNotification[]>([]);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const result = await notificationsService.list(signal);
      if (signal.aborted) return result;
      // The server enforces this filter; also protect against an incompatible API.
      const items = result.items.filter(
        (item) => admin.role !== 'MODERATOR' || item.kind !== 'SECURITY',
      );
      const previous = seen.current;
      if (previous) {
        const changed = items.filter(
          (item) => !item.read && item.revision > (previous.get(item.id) ?? 0),
        );
        if (changed.length)
          setToasts((current) =>
            [
              ...changed,
              ...current.filter(
                (item) => !changed.some((next) => next.id === item.id),
              ),
            ].slice(0, 3),
          );
      }
      seen.current = new Map(items.map((item) => [item.id, item.revision]));
      return { ...result, items };
    },
    [admin.role],
  );
  const state = usePolling(load, 15_000);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts([]), 12_000);
    return () => clearTimeout(timer);
  }, [toasts]);
  return (
    <Context.Provider value={state}>
      {children}
      <aside
        className="notification-toasts"
        aria-label="Новые уведомления"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <article
            key={`${item.id}:${item.revision}`}
            className={`notification-toast severity-${item.severity.toLowerCase()}`}
          >
            <button
              className="notification-dismiss"
              aria-label={`Скрыть уведомление: ${item.title}`}
              onClick={() =>
                setToasts((current) =>
                  current.filter((value) => value.id !== item.id),
                )
              }
            >
              ×
            </button>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <Link
              to="/admin/notifications"
              onClick={() =>
                setToasts((current) =>
                  current.filter((value) => value.id !== item.id),
                )
              }
            >
              Открыть уведомления
            </Link>
          </article>
        ))}
      </aside>
    </Context.Provider>
  );
}
export function NotificationBell() {
  const state = useNotifications();
  const [open, setOpen] = useState(false);
  const count = state.data?.unreadCount;
  return (
    <>
      <button
        className={`notification-bell ${state.error ? 'notification-offline' : ''}`}
        aria-label={`Уведомления${count ? `, непрочитанных: ${count}` : ''}`}
        title={state.error ? 'Не удалось обновить уведомления' : 'Уведомления'}
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" />
        {count ? (
          <span className="notification-count">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
        {state.error && <span aria-hidden="true">!</span>}
      </button>
      <Dialog open={open} title="Уведомления" onClose={() => setOpen(false)}>
        {state.error && (
          <p role="alert">
            Не удалось обновить уведомления. Показан последний полученный
            список.
          </p>
        )}
        {!state.data && state.loading && <p>Загрузка уведомлений…</p>}
        {state.data?.items.length === 0 && <p>Уведомлений пока нет.</p>}
        <div className="notification-preview">
          {state.data?.items.slice(0, 5).map((item) => (
            <article key={item.id} className={!item.read ? 'is-unread' : ''}>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              <small>
                {new Date(item.updatedAt).toLocaleString('ru-RU')}
                {item.resolvedAt ? ' · Закрыто' : ''}
              </small>
            </article>
          ))}
        </div>
        <Link
          className="button primary"
          to="/admin/notifications"
          onClick={() => setOpen(false)}
        >
          Вся история
        </Link>
      </Dialog>
    </>
  );
}
