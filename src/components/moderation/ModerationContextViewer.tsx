import { useEffect, useRef, useState } from 'react';
import { requestBlob } from '../../api/client';
import { adminService } from '../../services/admin.service';
import type {
  ContextLevel,
  ModerationAttachment,
  ModerationComment,
  ModerationMessage,
  ModerationPost,
  ReportContextContent,
  ReportTargetType,
  StaffRole,
} from '../../types/domain';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/Primitives';
import { reportTargetLabel } from '../../types/report-labels';

const levelLabel: Record<ContextLevel, string> = {
  REPORTED_ONLY: 'Содержимое жалобы',
  NEARBY: 'Соседние сообщения',
  EXTENDED: 'Дополнительный контекст',
};
export function ContextLevelSwitcher({
  active,
  role,
  onSelect,
  nearbyLabel = levelLabel.NEARBY,
}: {
  active: ContextLevel | null;
  role: StaffRole;
  onSelect: (level: ContextLevel, justification?: string) => void;
  nearbyLabel?: string;
}) {
  const [extendedOpen, setExtendedOpen] = useState(false);
  const [justification, setJustification] = useState('');
  return (
    <>
      <div
        className="context-levels"
        role="group"
        aria-label="Уровень контекста"
      >
        {(['REPORTED_ONLY', 'NEARBY'] satisfies ContextLevel[]).map((level) => (
          <button
            key={level}
            className={active === level ? 'active' : ''}
            aria-pressed={active === level}
            onClick={() => onSelect(level)}
          >
            {level === 'NEARBY' ? nearbyLabel : levelLabel[level]}
          </button>
        ))}
        {role !== 'MODERATOR' && (
          <button
            className={active === 'EXTENDED' ? 'active' : ''}
            aria-pressed={active === 'EXTENDED'}
            onClick={() => setExtendedOpen(true)}
          >
            Дополнительный контекст
          </button>
        )}
      </div>
      <Dialog
        open={extendedOpen}
        title="Дополнительный приватный контекст"
        onClose={() => setExtendedOpen(false)}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (justification.trim().length < 10) return;
            onSelect('EXTENDED', justification.trim());
            setExtendedOpen(false);
            setJustification('');
          }}
        >
          <p className="privacy-warning">
            Доступ будет записан в аудит. Укажите рабочее основание без
            приватного содержимого.
          </p>
          <label>
            Основание
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setExtendedOpen(false)}
            >
              Отмена
            </button>
            <button
              className="button primary"
              disabled={justification.trim().length < 10}
            >
              Запросить доступ
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
/** Файл из обращения в поддержку: пользователь приложил его сам. */
function useSupportPreview(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let objectUrl = '';
    requestBlob(path, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return url;
}
function Attachment({ value }: { value: ModerationAttachment }) {
  const previewUrl = useSupportPreview(value.previewPath);
  return (
    <div className="attachment">
      {previewUrl &&
        (value.kind === 'image' ? (
          <a href={previewUrl} target="_blank" rel="noreferrer">
            <img
              className="support-preview"
              src={previewUrl}
              alt="Вложение к обращению"
            />
          </a>
        ) : (
          <a
            className="button secondary"
            href={previewUrl}
            download={value.fileName ?? 'attachment'}
          >
            Открыть файл
          </a>
        ))}
      <span>
        <strong>{value.messageType || value.kind || 'Вложение'}</strong>
        <small>
          {value.mimeType || value.fileName || 'Безопасные метаданные'}
          {value.size ? ` · ${Math.ceil(value.size / 1024)} КБ` : ''}
        </small>
      </span>
      {value.previewAvailable && (
        <span className="safe-preview">Безопасный preview доступен</span>
      )}
    </div>
  );
}
export function MessageRow({
  message,
  reported = false,
}: {
  message: ModerationMessage;
  reported?: boolean;
}) {
  const author = message.author;
  return (
    <article className={reported ? 'reported-message' : ''}>
      <header>
        <strong>
          {author?.displayName ||
            author?.username ||
            author?.publicId ||
            'Удалённый пользователь'}
        </strong>
        {message.createdAt && (
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleString('ru-RU')}
          </time>
        )}
      </header>
      {message.deleted || message.status === 'DELETED' ? (
        <p className="deleted-text">Сообщение удалено</p>
      ) : message.contentUnavailableReason ? (
        <p className="deleted-text">
          Содержимое недоступно: {message.contentUnavailableReason}
        </p>
      ) : (
        <p>{message.text ?? 'Текст недоступен на этом уровне контекста'}</p>
      )}
      {(message.reply || message.messageSequence != null) && (
        <details className="message-technical">
          <summary>Служебные сведения сообщения</summary>
          {message.reply && (
            <p>
              Ответ на сообщение: <code>{message.reply.messageId}</code>
            </p>
          )}
          {message.messageSequence != null && (
            <p>Номер в переписке: {message.messageSequence}</p>
          )}
        </details>
      )}
      {message.attachment && <Attachment value={message.attachment} />}
    </article>
  );
}
export function PostCard({
  post,
  reported = false,
}: {
  post: ModerationPost;
  reported?: boolean;
}) {
  return (
    <article className={`post-card ${reported ? 'reported-message' : ''}`}>
      <header>
        <strong>
          {post.author?.displayName ||
            post.author?.username ||
            post.author?.publicId ||
            'Удалённый пользователь'}
        </strong>
        {post.createdAt && (
          <time dateTime={post.createdAt}>
            {new Date(post.createdAt).toLocaleString('ru-RU')}
          </time>
        )}
      </header>
      {post.topicHashtag && <small>{post.topicHashtag}</small>}
      {post.title && <h3>{post.title}</h3>}
      {post.deleted ? (
        <p className="deleted-text">Пост удалён или скрыт</p>
      ) : (
        <p>{post.body ?? 'Содержимое недоступно на этом уровне'}</p>
      )}
      {post.media && <Attachment value={post.media} />}
    </article>
  );
}
function CommentItem({
  comment,
  reported = false,
}: {
  comment: ModerationComment;
  reported?: boolean;
}) {
  return (
    <article className={reported ? 'reported-message' : ''}>
      <header>
        <strong>
          {comment.author?.displayName ||
            comment.author?.username ||
            comment.author?.publicId ||
            'Удалённый пользователь'}
        </strong>
        {comment.createdAt && (
          <time dateTime={comment.createdAt}>
            {new Date(comment.createdAt).toLocaleString('ru-RU')}
          </time>
        )}
      </header>
      <p className={comment.deleted ? 'deleted-text' : ''}>
        {comment.deleted
          ? 'Комментарий удалён (ветка сохранена)'
          : (comment.body ?? 'Содержимое недоступно')}
      </p>
      {comment.media && <Attachment value={comment.media} />}
    </article>
  );
}
export function CommentBranch({
  context,
}: {
  context: Extract<ReportContextContent, { kind: 'COMMENT' }>;
}) {
  return (
    <div className="comment-context">
      <section>
        <h3>Комментарий, на который пожаловались</h3>
        <CommentItem comment={context.target} reported />
      </section>
      <h3>Публикация и обсуждение</h3>
      <PostCard post={context.post} />
      {!!context.parents.length && (
        <section>
          <h3>Цепочка родителей</h3>
          {context.parents.map((item) => (
            <CommentItem key={item.id} comment={item} />
          ))}
        </section>
      )}
      {!!context.siblings.length && (
        <section>
          <h3>Соседние ответы</h3>
          {context.siblings.map((item) => (
            <CommentItem key={item.id} comment={item} />
          ))}
        </section>
      )}
      {!!context.children.length && (
        <section>
          <h3>Прямые ответы</h3>
          {context.children.map((item) => (
            <CommentItem key={item.id} comment={item} />
          ))}
        </section>
      )}
    </div>
  );
}
function ContextContent({ value }: { value: ReportContextContent }) {
  if (value.kind === 'MESSAGE')
    return (
      <div className="message-context">
        {value.before.map((item) => (
          <MessageRow key={item.id} message={item} />
        ))}
        <MessageRow message={value.target} reported />
        {value.after.map((item) => (
          <MessageRow key={item.id} message={item} />
        ))}
      </div>
    );
  if (value.kind === 'POST')
    return (
      <div className="post-context">
        <PostCard post={value.target} reported />
        {value.nearbyPosts?.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    );
  if (value.kind === 'COMMENT') return <CommentBranch context={value} />;
  return (
    <div className="context-consent">
      <strong>{reportTargetLabel[value.kind]}</strong>
      <p>Для этой цели доступна только безопасная служебная информация.</p>
      <details>
        <summary>Идентификатор объекта</summary>
        <code>{value.target.id ?? 'ID отсутствует'}</code>
      </details>
      {value.target.deleted && <p className="deleted-text">Объект удалён</p>}
    </div>
  );
}
export function ModerationContextViewer({
  reportId,
  role,
  targetType,
}: {
  reportId: string;
  role: StaffRole;
  targetType?: ReportTargetType;
}) {
  const requestGeneration = useRef(0);
  const [level, setLevel] = useState<ContextLevel | null>(null);
  const [context, setContext] = useState<ReportContextContent | null>(null);
  const [limits, setLimits] = useState({ before: 3, after: 3 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extendedJustification, setExtendedJustification] = useState('');
  const load = async (
    next: ContextLevel,
    justification?: string,
    before = limits.before,
    after = limits.after,
  ) => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError('');
    try {
      const result = await adminService.reportContext(reportId, {
        level: next,
        before,
        after,
        justification,
      });
      if (generation !== requestGeneration.current) return;
      setContext(result);
      setLevel(next);
      if (next === 'EXTENDED' && justification)
        setExtendedJustification(justification);
    } catch (reason) {
      if (generation === requestGeneration.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось загрузить контекст',
        );
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };
  return (
    <section className="card context-panel">
      <div className="card-head">
        <div>
          <span className="section-label">Просмотр фиксируется в аудите</span>
          <h2>
            {targetType === 'SUPPORT'
              ? 'Содержимое обращения'
              : 'Содержимое и контекст жалобы'}
          </h2>
        </div>
      </div>
      <ContextLevelSwitcher
        active={level}
        role={role}
        nearbyLabel={
          targetType === 'POST'
            ? 'Соседние публикации'
            : targetType === 'COMMENT'
              ? 'Ветка обсуждения'
              : undefined
        }
        onSelect={(next, reason) => void load(next, reason)}
      />
      {!level && (
        <div className="context-consent">
          <strong>Приватный контент не загружен</strong>
          <p>
            Откройте содержимое жалобы. Если его недостаточно для решения,
            запросите соседние сообщения или дополнительный контекст.
          </p>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        context && (
          <>
            <ContextLocation value={context} />
            <ContextContent value={context} />
          </>
        )
      )}
      {context?.kind === 'MESSAGE' && level !== 'REPORTED_ONLY' && (
        <div className="context-pagination">
          <button
            className="button secondary"
            disabled={loading || context.hasMoreBefore === false}
            onClick={() => {
              const next = { ...limits, before: limits.before + 5 };
              setLimits(next);
              void load(
                level!,
                level === 'EXTENDED' ? extendedJustification : undefined,
                next.before,
                next.after,
              );
            }}
          >
            Показать ещё до
          </button>
          <button
            className="button secondary"
            disabled={loading || context.hasMoreAfter === false}
            onClick={() => {
              const next = { ...limits, after: limits.after + 5 };
              setLimits(next);
              void load(
                level!,
                level === 'EXTENDED' ? extendedJustification : undefined,
                next.before,
                next.after,
              );
            }}
          >
            Показать ещё после
          </button>
        </div>
      )}
    </section>
  );
}

function ContextLocation({ value }: { value: ReportContextContent }) {
  const location =
    value.kind === 'MESSAGE'
      ? 'Переписка'
      : value.kind === 'POST'
        ? value.target.topicHashtag || 'Лента публикаций'
        : value.kind === 'COMMENT'
          ? value.post.topicHashtag ||
            value.post.title ||
            'Обсуждение публикации'
          : reportTargetLabel[value.kind];
  const id =
    value.kind === 'MESSAGE'
      ? value.chatId
      : value.kind === 'POST'
        ? value.target.topicId
        : value.kind === 'COMMENT'
          ? value.target.postId
          : undefined;
  return (
    <div className="context-location">
      <span>
        Место: <strong>{location}</strong>
      </span>
      {id && (
        <details>
          <summary>Идентификатор места</summary>
          <code>{id}</code>
        </details>
      )}
    </div>
  );
}
