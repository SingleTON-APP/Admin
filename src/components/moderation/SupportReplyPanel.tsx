import { useState } from 'react';
import { adminService } from '../../services/admin.service';
import type { ReportDetails } from '../../types/domain';

/**
 * Ответ на обращение в поддержку. Текст приходит пользователю в системный
 * чат «Hub» (там же он писал /support); обращение переходит «на рассмотрение».
 */
export function SupportReplyPanel({
  report,
  onSent,
}: {
  report: ReportDetails;
  onSent: () => void;
}) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const closed = report.status === 'RESOLVED' || report.status === 'REJECTED';

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setState('sending');
    try {
      await adminService.replySupport(report.id, body);
      setText('');
      setState('sent');
      onSent();
    } catch {
      setState('error');
    }
  };

  return (
    <section className="card support-reply">
      <div className="card-head">
        <h2>Ответ пользователю</h2>
      </div>
      <p className="data-note">
        Сообщение придёт пользователю в чат «Hub» от имени поддержки.
      </p>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value.slice(0, 4000));
          if (state !== 'sending') setState('idle');
        }}
        rows={5}
        placeholder={closed ? 'Обращение закрыто' : 'Напишите ответ…'}
        disabled={closed || state === 'sending'}
      />
      <div className="support-reply-actions">
        {state === 'sent' && <span className="data-note">Отправлено</span>}
        {state === 'error' && (
          <span className="state-error" role="alert">
            Не удалось отправить ответ
          </span>
        )}
        <button
          className="button"
          onClick={() => void send()}
          disabled={closed || !text.trim() || state === 'sending'}
        >
          Отправить
        </button>
      </div>
    </section>
  );
}
