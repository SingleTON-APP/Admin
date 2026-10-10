import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { SITE_PUBLIC_URL } from '../api/site-client';
import { Dialog } from '../components/ui/Dialog';
import { SiteArticleEditor } from '../components/site-content/SiteArticleEditor';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../components/ui/Primitives';
import { useAdmin } from '../features/admin-access/AdminContext';
import { siteContentService } from '../services/site-content.service';
import type { SiteNewsDraft, SiteNewsItem } from '../types/site-content';
import '../styles/site-content.css';

function emptyDraft(): SiteNewsDraft {
  return {
    title: '',
    description: '',
    image: null,
    content: '',
    date: new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
    }).format(new Date()),
  };
}

function itemDraft(item: SiteNewsItem): SiteNewsDraft {
  return {
    title: item.title,
    description: item.description,
    image: item.image,
    content: item.content || '',
    date: item.date,
  };
}

function DeleteNewsDialog({
  item,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  item: SiteNewsItem;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [deadline] = useState(() => performance.now() + 5000);
  const [remaining, setRemaining] = useState(5);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((deadline - performance.now()) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return (
    <Dialog
      open
      title="Удалить новость?"
      onClose={onClose}
      dismissDisabled={saving}
    >
      <div className="form-stack">
        <p>
          Публикация «<strong>{item.title}</strong>» исчезнет с главного сайта и
          из списка новостей. Отменить удаление не получится.
        </p>
        <p className="muted" role="status">
          {remaining > 0
            ? `Подтверждение станет доступно через ${remaining} сек.`
            : 'Можно подтвердить удаление или отменить действие.'}
        </p>
        {error && (
          <p
            className="site-content-alert site-content-alert-error"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={saving}
            autoFocus
          >
            Отмена
          </button>
          <button
            type="button"
            className="button danger"
            disabled={saving || remaining > 0}
            onClick={() => {
              if (!saving && performance.now() >= deadline) onConfirm();
            }}
          >
            {saving
              ? 'Удаление…'
              : remaining > 0
                ? `Удалить через ${remaining} сек.`
                : 'Удалить навсегда'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function SiteNewsPage() {
  const admin = useAdmin();
  const canManage = admin.role === 'ADMIN' || admin.role === 'FULL_ADMIN';
  const [items, setItems] = useState<SiteNewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SiteNewsDraft>(emptyDraft);
  const [loading, setLoading] = useState(canManage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteNewsItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await siteContentService.list(signal));
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === 'AbortError'
      ) {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить новости',
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [canManage, load]);

  function startNew() {
    setSelectedId(null);
    setDraft(emptyDraft());
    setError(null);
    setNotice(null);
  }

  function startEdit(item: SiteNewsItem) {
    setSelectedId(item.id);
    setDraft(itemDraft(item));
    setError(null);
    setNotice(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (
      !draft.title.trim() ||
      !draft.description.trim() ||
      !draft.date.trim()
    ) {
      setError('Заполните заголовок, краткое описание и дату');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = selected
        ? await siteContentService.update(selected.id, draft)
        : await siteContentService.create(draft);
      setItems((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setSelectedId(saved.id);
      setDraft(itemDraft(saved));
      setNotice(selected ? 'Изменения сохранены' : 'Новость опубликована');
      window.setTimeout(() => setNotice(null), 3000);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось сохранить новость',
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: SiteNewsItem) {
    if (saving) return;
    setSaving(true);
    setDeleteError(null);
    setNotice(null);
    try {
      await siteContentService.remove(item.id);
      if (selectedId === item.id) startNew();
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setDeleteTarget(null);
      setNotice('Новость удалена');
      window.setTimeout(() => setNotice(null), 3000);
    } catch (removeError) {
      setDeleteError(
        removeError instanceof Error
          ? removeError.message
          : 'Не удалось удалить новость',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <ErrorState message="Для управления сайтом нужна роль администратора" />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Контент сайта"
        title="Новости"
        description="Создание и редактирование публикаций главного сайта Hub"
        actions={
          <>
            <a
              className="button secondary"
              href={SITE_PUBLIC_URL}
              target="_blank"
              rel="noreferrer"
            >
              Открыть сайт
            </a>
            <button
              className="button primary"
              type="button"
              onClick={startNew}
              disabled={saving}
            >
              Новая статья
            </button>
          </>
        }
      />

      {error && (
        <div
          className="site-content-alert site-content-alert-error"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div
          className="site-content-alert site-content-alert-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="site-content-layout">
        <aside className="site-news-sidebar card">
          <div className="card-head">
            <div>
              <h2>Публикации</h2>
              <p>{items.length} на сайте</p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => void load()}
              disabled={saving || loading}
            >
              Обновить
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Новостей пока нет" />
          ) : (
            <div className="site-news-list">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`site-news-item ${selectedId === item.id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={saving}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <small>
                      {item.date} · обновлено{' '}
                      {new Date(`${item.updated_at}Z`).toLocaleDateString(
                        'ru-RU',
                      )}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="site-news-delete"
                    onClick={() => {
                      setDeleteTarget(item);
                      setDeleteError(null);
                    }}
                    disabled={saving}
                    aria-label={`Удалить ${item.title}`}
                    title="Удалить"
                  >
                    Удалить
                  </button>
                </article>
              ))}
            </div>
          )}
        </aside>

        <form className="site-news-form" onSubmit={(event) => void save(event)}>
          <div className="site-news-form-head">
            <div>
              <p className="eyebrow">
                {selected ? `Статья #${selected.id}` : 'Новая статья'}
              </p>
              <h2>
                {selected
                  ? 'Редактирование публикации'
                  : 'Подготовка публикации'}
              </h2>
            </div>
            <label>
              <span>Дата на карточке</span>
              <input
                value={draft.date}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                placeholder="09 окт."
                maxLength={40}
                disabled={saving}
                required
              />
            </label>
          </div>

          <SiteArticleEditor
            title={draft.title}
            description={draft.description}
            banner={draft.image}
            content={draft.content}
            disabled={saving}
            onTitleChange={(title) =>
              setDraft((current) => ({ ...current, title }))
            }
            onDescriptionChange={(description) =>
              setDraft((current) => ({ ...current, description }))
            }
            onBannerChange={(image) =>
              setDraft((current) => ({ ...current, image }))
            }
            onContentChange={(content) =>
              setDraft((current) => ({ ...current, content }))
            }
            onError={setError}
          />

          <div className="site-news-form-actions">
            {selected && (
              <button
                className="button danger site-news-delete-action"
                type="button"
                disabled={saving}
                onClick={() => {
                  setDeleteTarget(selected);
                  setDeleteError(null);
                }}
              >
                Удалить новость
              </button>
            )}
            <button
              className="button secondary"
              type="button"
              onClick={startNew}
              disabled={saving}
            >
              Сбросить
            </button>
            <button className="button primary" type="submit" disabled={saving}>
              {saving
                ? 'Сохранение…'
                : selected
                  ? 'Сохранить изменения'
                  : 'Опубликовать'}
            </button>
          </div>
        </form>
      </div>
      {deleteTarget && (
        <DeleteNewsDialog
          key={deleteTarget.id}
          item={deleteTarget}
          saving={saving}
          error={deleteError}
          onClose={() => {
            if (!saving) setDeleteTarget(null);
          }}
          onConfirm={() => void remove(deleteTarget)}
        />
      )}
    </>
  );
}
