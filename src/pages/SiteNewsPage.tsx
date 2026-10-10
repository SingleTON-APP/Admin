import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
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
          {item.status === 'DRAFT' ? 'Черновик' : 'Публикация'} «
          <strong>{item.title || 'Без заголовка'}</strong>» будет удалён
          {item.status === 'DRAFT' ? '' : 'а'}.
          {item.status !== 'DRAFT' && ' Новость исчезнет с главного сайта.'}{' '}
          Отменить удаление не получится.
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
  const [params] = useSearchParams();
  const requestedId = Number(params.get('article')) || null;
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
  const [draftKey, setDraftKey] = useState(() => crypto.randomUUID());
  const [lastSaved, setLastSaved] = useState(() =>
    JSON.stringify(emptyDraft()),
  );
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const editorGeneration = useRef(0);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const meaningful = Boolean(
    draft.title.trim() ||
    draft.description.trim() ||
    draft.content.trim() ||
    draft.image,
  );
  const dirty =
    (meaningful || selected !== null) && JSON.stringify(draft) !== lastSaved;
  const busy = saving || autoSaving;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (blocker.state === 'blocked' && !dirty) blocker.proceed();
  }, [blocker, dirty]);

  useEffect(() => {
    if (
      !canManage ||
      loading ||
      busy ||
      autoError ||
      deleteTarget ||
      !dirty ||
      (selected && selected.status !== 'DRAFT')
    )
      return;
    const snapshot = draft;
    const generation = editorGeneration.current;
    const timer = window.setTimeout(() => {
      setAutoSaving(true);
      void siteContentService
        .saveDraft(snapshot, draftKey, selected)
        .then((saved) => {
          if (editorGeneration.current !== generation) return;
          setItems((current) => [
            saved,
            ...current.filter((item) => item.id !== saved.id),
          ]);
          setSelectedId(saved.id);
          setLastSaved(JSON.stringify(snapshot));
        })
        .catch((failure) => {
          if (editorGeneration.current === generation)
            setAutoError(
              failure instanceof Error
                ? failure.message
                : 'Не удалось сохранить черновик',
            );
        })
        .finally(() => setAutoSaving(false));
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    canManage,
    loading,
    busy,
    autoError,
    deleteTarget,
    dirty,
    draft,
    draftKey,
    selected,
  ]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      await Promise.resolve();
      if (signal?.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await siteContentService.list(signal);
        setItems(rows);
        const requested = rows.find((item) => item.id === requestedId);
        if (requested) {
          editorGeneration.current++;
          setSelectedId(requested.id);
          setDraft(itemDraft(requested));
          setLastSaved(JSON.stringify(itemDraft(requested)));
          setAutoError(null);
        }
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
    },
    [requestedId],
  );

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [canManage, load]);

  function startNew() {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        'Оставить несохранённые изменения и открыть новую статью?',
      )
    )
      return;
    editorGeneration.current++;
    setDraftKey(crypto.randomUUID());
    setLastSaved(JSON.stringify(emptyDraft()));
    setAutoError(null);
    setSelectedId(null);
    setDraft(emptyDraft());
    setError(null);
    setNotice(null);
  }

  function startEdit(item: SiteNewsItem) {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        'Оставить несохранённые изменения и открыть другую статью?',
      )
    )
      return;
    editorGeneration.current++;
    setLastSaved(JSON.stringify(itemDraft(item)));
    setAutoError(null);
    setSelectedId(item.id);
    setDraft(itemDraft(item));
    setError(null);
    setNotice(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || loading) return;
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
        ? await siteContentService.update(selected.id, draft, selected.revision)
        : await siteContentService.create(draft);
      setItems((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setSelectedId(saved.id);
      setDraft(itemDraft(saved));
      setLastSaved(JSON.stringify(itemDraft(saved)));
      setAutoError(null);
      setNotice(
        selected && selected.status !== 'DRAFT'
          ? 'Изменения сохранены'
          : 'Новость опубликована',
      );
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
    if (busy) return;
    setSaving(true);
    setDeleteError(null);
    setNotice(null);
    try {
      await siteContentService.remove(item.id);
      if (selectedId === item.id) {
        editorGeneration.current++;
        setSelectedId(null);
        setDraft(emptyDraft());
        setLastSaved(JSON.stringify(emptyDraft()));
        setDraftKey(crypto.randomUUID());
        setAutoError(null);
      }
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
              disabled={busy}
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
              <p>
                Опубликовано:{' '}
                {items.filter((item) => item.status !== 'DRAFT').length} ·
                Черновики:{' '}
                {items.filter((item) => item.status === 'DRAFT').length}
              </p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => void load()}
              disabled={busy || loading || dirty}
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
                    disabled={busy}
                  >
                    <strong>{item.title || 'Без заголовка'}</strong>
                    <span>{item.description}</span>
                    <small>
                      {item.status === 'DRAFT' ? 'Черновик' : 'Опубликовано'} ·{' '}
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
                    disabled={busy}
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
                {selected?.status === 'DRAFT'
                  ? 'Редактирование черновика'
                  : selected
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

          <div
            className={`site-content-alert site-news-save-status${autoError ? ' site-content-alert-error' : ''}`}
            role="status"
          >
            {autoError ? (
              <>
                <span>{autoError}</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setAutoError(null)}
                  disabled={busy}
                >
                  Повторить сохранение
                </button>
              </>
            ) : selected && selected.status !== 'DRAFT' ? (
              'Изменения опубликованной статьи появятся на сайте после сохранения.'
            ) : autoSaving ? (
              'Сохраняем черновик…'
            ) : dirty ? (
              'Есть изменения — черновик сохранится автоматически.'
            ) : selected?.status === 'DRAFT' ? (
              'Черновик сохранён на сервере. На сайте его ещё нет.'
            ) : (
              'Начните писать — черновик сохранится автоматически.'
            )}
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
                disabled={busy}
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
              disabled={busy}
            >
              Сбросить
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={busy || loading}
            >
              {saving
                ? 'Сохранение…'
                : selected && selected.status !== 'DRAFT'
                  ? 'Сохранить изменения'
                  : 'Опубликовать'}
            </button>
          </div>
        </form>
      </div>
      {blocker.state === 'blocked' && (
        <Dialog
          open
          title="Остались несохранённые изменения"
          onClose={() => blocker.reset()}
        >
          <div className="form-stack">
            <p>
              Дождитесь сохранения черновика или сохраните изменения статьи.
              Если уйти сейчас, последние изменения потеряются.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                autoFocus
                onClick={() => blocker.reset()}
              >
                Продолжить редактирование
              </button>
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => blocker.proceed()}
              >
                Уйти без сохранения
              </button>
            </div>
          </div>
        </Dialog>
      )}
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
