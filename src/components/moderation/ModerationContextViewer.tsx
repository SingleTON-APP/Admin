import { useState } from 'react';
import { adminService } from '../../services/admin.service';
import type {
  ContextLevel, ModerationComment, ModerationMessage, ModerationPost, ReportContextContent, StaffRole,
} from '../../types/domain';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/Primitives';

const levelLabel: Record<ContextLevel, string> = {
  REPORTED_ONLY: 'Только объект', NEARBY: 'Ближний контекст', EXTENDED: 'Расширенный',
};
export function ContextLevelSwitcher({ active, role, onSelect }: {
  active: ContextLevel | null; role: StaffRole; onSelect: (level: ContextLevel, justification?: string) => void;
}) {
  const [extendedOpen, setExtendedOpen] = useState(false);
  const [justification, setJustification] = useState('');
  return <>
    <div className="context-levels" role="group" aria-label="Уровень контекста">
      {(['REPORTED_ONLY','NEARBY'] satisfies ContextLevel[]).map((level) =>
        <button key={level} className={active === level ? 'active' : ''} onClick={() => onSelect(level)}>{levelLabel[level]}</button>)}
      {role !== 'MODERATOR' && <button className={active === 'EXTENDED' ? 'active' : ''}
        onClick={() => setExtendedOpen(true)}>Расширенный</button>}
    </div>
    <Dialog open={extendedOpen} title="Расширенный приватный контекст" onClose={() => setExtendedOpen(false)}>
      <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        if (justification.trim().length < 10) return;
        onSelect('EXTENDED', justification.trim()); setExtendedOpen(false); setJustification('');
      }}>
        <p className="privacy-warning">Доступ будет записан в аудит. Укажите рабочее основание без копирования приватного содержимого.</p>
        <label>Основание<textarea required minLength={10} maxLength={500} value={justification}
          onChange={(event) => setJustification(event.target.value)} /></label>
        <div className="dialog-actions"><button type="button" className="button secondary"
          onClick={() => setExtendedOpen(false)}>Отмена</button>
          <button className="button primary" disabled={justification.trim().length < 10}>Запросить доступ</button></div>
      </form>
    </Dialog>
  </>;
}
export function MessageRow({ message, reported = false }: { message: ModerationMessage; reported?: boolean }) {
  return <article className={reported ? 'reported-message' : ''}>
    <header><strong>{message.authorName || message.authorId || 'Удалённый пользователь'}</strong>
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ru-RU')}</time>
      {message.messageSequence !== null && message.messageSequence !== undefined && <code>#{message.messageSequence}</code>}</header>
    {message.deleted ? <p className="deleted-text">Сообщение удалено</p> :
      <p>{message.text ?? 'Текст недоступен на этом уровне контекста'}</p>}
    {message.replyToId && <small>Ответ на {message.replyToId}</small>}
    {message.attachments.map((attachment, index) => <div className="attachment" key={attachment.id ?? index}>
      <span><strong>{attachment.kind}</strong><small>{attachment.mimeType ?? 'Вложение'} · {
        attachment.size ? `${Math.ceil(attachment.size / 1024)} КБ` : 'размер неизвестен'
      }</small></span>{attachment.previewAvailable && <span className="safe-preview">Безопасный preview доступен</span>}
    </div>)}
  </article>;
}
export function PostCard({ post, reported = false }: { post: ModerationPost; reported?: boolean }) {
  return <article className={`post-card ${reported ? 'reported-message' : ''}`}>
    <header><strong>{post.authorName || post.authorId || 'Удалённый пользователь'}</strong>
      <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('ru-RU')}</time></header>
    {post.title && <h3>{post.title}</h3>}
    {post.deleted ? <p className="deleted-text">Пост удалён или скрыт</p> :
      <p>{post.body ?? 'Содержимое недоступно на этом уровне'}</p>}
    {post.media.map((item, index) => <div className="attachment" key={item.id ?? index}>
      <span><strong>{item.kind}</strong><small>{item.mimeType ?? 'Медиа'} · безопасные метаданные</small></span>
    </div>)}
  </article>;
}
function CommentItem({ comment, reported = false }: { comment: ModerationComment; reported?: boolean }) {
  return <article className={reported ? 'reported-message' : ''}><header>
    <strong>{comment.authorName || comment.authorId || 'Удалённый пользователь'}</strong>
    <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ru-RU')}</time></header>
    <p className={comment.deleted ? 'deleted-text' : ''}>{comment.deleted ? 'Комментарий удалён (ветка сохранена)' :
      comment.body ?? 'Содержимое недоступно'}</p></article>;
}
export function CommentBranch({ context }: { context: Extract<ReportContextContent, { kind: 'COMMENT' }> }) {
  return <div className="comment-context"><PostCard post={context.post} />
    {!!context.parent_chain.length && <section><h3>Цепочка родителей</h3>{context.parent_chain.map((item) =>
      <CommentItem key={item.id} comment={item} />)}</section>}
    <section><h3>Объект жалобы</h3><CommentItem comment={context.target} reported /></section>
    {!!context.siblings.length && <section><h3>Соседние ответы</h3>{context.siblings.map((item) =>
      <CommentItem key={item.id} comment={item} />)}</section>}
    {!!context.children.length && <section><h3>Прямые ответы</h3>{context.children.map((item) =>
      <CommentItem key={item.id} comment={item} />)}{context.has_more_children && <p className="data-note">В ветке есть ещё ответы.</p>}</section>}
  </div>;
}
function ContextContent({ value }: { value: ReportContextContent }) {
  if (value.kind === 'MESSAGE') return <div className="message-context">
    {value.before.map((item) => <MessageRow key={item.id} message={item} />)}
    <MessageRow message={value.target} reported />
    {value.after.map((item) => <MessageRow key={item.id} message={item} />)}
  </div>;
  if (value.kind === 'POST') return <div className="post-context"><PostCard post={value.target} reported />
    {value.nearby_posts?.map((post) => <PostCard key={post.id} post={post} />)}</div>;
  return <CommentBranch context={value} />;
}
export function ModerationContextViewer({ reportId, role }: { reportId: string; role: StaffRole }) {
  const [level, setLevel] = useState<ContextLevel | null>(null);
  const [context, setContext] = useState<ReportContextContent | null>(null);
  const [limits, setLimits] = useState({ before: 3, after: 3 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async (next: ContextLevel, justification?: string, before = limits.before, after = limits.after) => {
    setLoading(true); setError('');
    try { setContext(await adminService.reportContext(reportId, { level: next, before, after, justification })); setLevel(next); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить контекст'); }
    finally { setLoading(false); }
  };
  return <section className="card context-panel"><div className="card-head"><div>
    <span className="section-label">Privacy controlled</span><h2>Контекст жалобы</h2></div></div>
    <ContextLevelSwitcher active={level} role={role} onSelect={(next, reason) => void load(next, reason)} />
    {!level && <div className="context-consent"><strong>Приватный контент не загружен</strong>
      <p>Выберите уровень. Просмотр содержимого фиксируется в журнале аудита.</p></div>}
    {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : context && <ContextContent value={context} />}
    {context?.kind === 'MESSAGE' && level !== 'REPORTED_ONLY' && <div className="context-pagination">
      <button className="button secondary" disabled={loading || context.hasMoreBefore === false} onClick={() => {
        const next = { ...limits, before: limits.before + 5 }; setLimits(next); void load(level!, undefined, next.before, next.after);
      }}>Показать ещё до</button>
      <button className="button secondary" disabled={loading || context.hasMoreAfter === false} onClick={() => {
        const next = { ...limits, after: limits.after + 5 }; setLimits(next); void load(level!, undefined, next.before, next.after);
      }}>Показать ещё после</button>
    </div>}
  </section>;
}
