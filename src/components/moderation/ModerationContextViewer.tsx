import { useState } from 'react';
import { adminService } from '../../services/admin.service';
import type {
  ContextLevel, ModerationAttachment, ModerationComment, ModerationMessage, ModerationPost,
  ReportContextContent, StaffRole,
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
        event.preventDefault(); if (justification.trim().length < 10) return;
        onSelect('EXTENDED', justification.trim()); setExtendedOpen(false); setJustification('');
      }}>
        <p className="privacy-warning">Доступ будет записан в аудит. Укажите рабочее основание без приватного содержимого.</p>
        <label>Основание<textarea required minLength={10} maxLength={500} value={justification}
          onChange={(event) => setJustification(event.target.value)} /></label>
        <div className="dialog-actions"><button type="button" className="button secondary"
          onClick={() => setExtendedOpen(false)}>Отмена</button>
          <button className="button primary" disabled={justification.trim().length < 10}>Запросить доступ</button></div>
      </form>
    </Dialog>
  </>;
}
function Attachment({ value }: { value: ModerationAttachment }) {
  return <div className="attachment"><span><strong>{value.messageType || value.kind || 'Вложение'}</strong>
    <small>{value.mimeType || value.fileName || 'Безопасные метаданные'}{
      value.size ? ` · ${Math.ceil(value.size / 1024)} КБ` : ''}</small></span>
    {value.previewAvailable && <span className="safe-preview">Безопасный preview доступен</span>}</div>;
}
export function MessageRow({ message, reported = false }: { message: ModerationMessage; reported?: boolean }) {
  const author = message.author;
  return <article className={reported ? 'reported-message' : ''}>
    <header><strong>{author?.displayName || author?.username || author?.publicId || 'Удалённый пользователь'}</strong>
      {message.createdAt && <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ru-RU')}</time>}
      {message.messageSequence !== null && message.messageSequence !== undefined && <code>#{message.messageSequence}</code>}</header>
    {message.deleted || message.status === 'DELETED' ? <p className="deleted-text">Сообщение удалено</p> :
      message.contentUnavailableReason ? <p className="deleted-text">Содержимое недоступно: {message.contentUnavailableReason}</p> :
      <p>{message.text ?? 'Текст недоступен на этом уровне контекста'}</p>}
    {message.reply && <small>Ответ на {message.reply.messageId}</small>}
    {message.attachment && <Attachment value={message.attachment} />}
  </article>;
}
export function PostCard({ post, reported = false }: { post: ModerationPost; reported?: boolean }) {
  return <article className={`post-card ${reported ? 'reported-message' : ''}`}>
    <header><strong>{post.author?.displayName || post.author?.username || post.author?.publicId || 'Удалённый пользователь'}</strong>
      {post.createdAt && <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('ru-RU')}</time>}</header>
    {post.topicHashtag && <small>{post.topicHashtag}</small>}{post.title && <h3>{post.title}</h3>}
    {post.deleted ? <p className="deleted-text">Пост удалён или скрыт</p> :
      <p>{post.body ?? 'Содержимое недоступно на этом уровне'}</p>}
    {post.media && <Attachment value={post.media} />}
  </article>;
}
function CommentItem({ comment, reported = false }: { comment: ModerationComment; reported?: boolean }) {
  return <article className={reported ? 'reported-message' : ''}><header>
    <strong>{comment.author?.displayName || comment.author?.username || comment.author?.publicId || 'Удалённый пользователь'}</strong>
    {comment.createdAt && <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ru-RU')}</time>}</header>
    <p className={comment.deleted ? 'deleted-text' : ''}>{comment.deleted ? 'Комментарий удалён (ветка сохранена)' :
      comment.body ?? 'Содержимое недоступно'}</p>{comment.media && <Attachment value={comment.media} />}</article>;
}
export function CommentBranch({ context }: { context: Extract<ReportContextContent, { kind: 'COMMENT' }> }) {
  return <div className="comment-context"><PostCard post={context.post} />
    {!!context.parents.length && <section><h3>Цепочка родителей</h3>{context.parents.map((item) =>
      <CommentItem key={item.id} comment={item} />)}</section>}
    <section><h3>Объект жалобы</h3><CommentItem comment={context.target} reported /></section>
    {!!context.siblings.length && <section><h3>Соседние ответы</h3>{context.siblings.map((item) =>
      <CommentItem key={item.id} comment={item} />)}</section>}
    {!!context.children.length && <section><h3>Прямые ответы</h3>{context.children.map((item) =>
      <CommentItem key={item.id} comment={item} />)}</section>}
  </div>;
}
function ContextContent({ value }: { value: ReportContextContent }) {
  if (value.kind === 'MESSAGE') return <div className="message-context">
    {value.before.map((item) => <MessageRow key={item.id} message={item} />)}
    <MessageRow message={value.target} reported />
    {value.after.map((item) => <MessageRow key={item.id} message={item} />)}
  </div>;
  if (value.kind === 'POST') return <div className="post-context"><PostCard post={value.target} reported />
    {value.nearbyPosts?.map((post) => <PostCard key={post.id} post={post} />)}</div>;
  if (value.kind === 'COMMENT') return <CommentBranch context={value} />;
  return <div className="context-consent"><strong>{value.kind}</strong>
    <p>Для этой цели доступна только безопасная служебная информация.</p>
    <code>{value.target.id ?? 'ID отсутствует'}</code>
    {value.target.deleted && <p className="deleted-text">Объект удалён</p>}</div>;
}
export function ModerationContextViewer({ reportId, role }: { reportId: string; role: StaffRole }) {
  const [level, setLevel] = useState<ContextLevel | null>(null);
  const [context, setContext] = useState<ReportContextContent | null>(null);
  const [limits, setLimits] = useState({ before: 3, after: 3 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extendedJustification, setExtendedJustification] = useState('');
  const load = async (next: ContextLevel, justification?: string, before = limits.before, after = limits.after) => {
    setLoading(true); setError('');
    try {
      setContext(await adminService.reportContext(reportId, { level: next, before, after, justification }));
      setLevel(next); if (next === 'EXTENDED' && justification) setExtendedJustification(justification);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить контекст'); }
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
        const next = { ...limits, before: limits.before + 5 }; setLimits(next);
        void load(level!, level === 'EXTENDED' ? extendedJustification : undefined, next.before, next.after);
      }}>Показать ещё до</button>
      <button className="button secondary" disabled={loading || context.hasMoreAfter === false} onClick={() => {
        const next = { ...limits, after: limits.after + 5 }; setLimits(next);
        void load(level!, level === 'EXTENDED' ? extendedJustification : undefined, next.before, next.after);
      }}>Показать ещё после</button>
    </div>}
  </section>;
}
