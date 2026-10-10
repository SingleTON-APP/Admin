import { useState, type FormEvent } from 'react';
import { useAdmin } from '../../features/admin-access/AdminContext';
import { operationsV3Service } from '../../services/operations-v3.service';
import type { Report } from '../../types/domain';
import { ApiError } from '../../api/contracts';
import { useCurrentTime } from '../../hooks/useCurrentTime';

export function ReportDeadline({
  report,
  onChanged,
}: {
  report: Report;
  onChanged: () => void;
}) {
  const now = useCurrentTime();
  const actor = useAdmin();
  const [dueAt, setDueAt] = useState(() => {
    if (!report.dueAt) return '';
    const date = new Date(report.dueAt);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const canEdit =
    ['OPEN', 'IN_REVIEW'].includes(report.status) &&
    (actor.role !== 'MODERATOR' || report.assignee?.id === actor.id);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || busy || reason.trim().length < 10) return;
    setBusy(true);
    setMessage('');
    try {
      await operationsV3Service.deadline(
        report.id,
        dueAt ? new Date(dueAt).toISOString() : null,
        report.updatedAt,
        reason.trim(),
      );
      setReason('');
      onChanged();
    } catch (failure) {
      setMessage(
        failure instanceof ApiError && failure.status === 409
          ? 'Жалоба изменилась или уже закрыта. Обновите её перед изменением срока.'
          : failure instanceof Error
            ? failure.message
            : 'Срок не сохранён.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card form-stack">
      <h2>Срок обработки</h2>
      <p>
        {report.dueAt
          ? new Date(report.dueAt).toLocaleString('ru-RU')
          : 'Срок не назначен'}
      </p>
      {report.dueAt &&
        Date.parse(report.dueAt) < now &&
        ['OPEN', 'IN_REVIEW'].includes(report.status) && (
          <p className="text-danger">Срок обработки истёк</p>
        )}
      {canEdit ? (
        <form className="form-stack" onSubmit={(event) => void save(event)}>
          <label>
            Новый срок, местное время
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={busy}
            />
          </label>
          <p className="data-note">
            Пустой новый срок снимает дедлайн. Изменение требует причины;
            заметки и взятие в работу доступны в действиях по жалобе.
          </p>
          <label>
            Причина изменения срока
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
              disabled={busy}
            />
          </label>
          <button
            className="button secondary"
            disabled={busy || reason.trim().length < 10}
          >
            Сохранить срок
          </button>
        </form>
      ) : (
        <p className="data-note">
          Срок открытой жалобы меняет назначенный модератор или администратор.
        </p>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
