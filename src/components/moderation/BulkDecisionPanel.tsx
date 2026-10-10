import { useState, type FormEvent } from 'react';
import { Dialog } from '../ui/Dialog';
import {
  operationsV3Service,
  type BulkPreview,
} from '../../services/operations-v3.service';
import { ApiError } from '../../api/contracts';
import { useCurrentTime } from '../../hooks/useCurrentTime';

export function BulkDecisionPanel({
  ids,
  onClear,
  onChanged,
}: {
  ids: string[];
  onClear: () => void;
  onChanged: () => void;
}) {
  const now = useCurrentTime();
  const [action, setAction] = useState<BulkPreview['action']>('RESOLVE_REPORT');
  const [reason, setReason] = useState('');
  const [publicReason, setPublicReason] = useState('');
  const [preview, setPreview] = useState<{
    data: BulkPreview;
    key: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function create(event: FormEvent) {
    event.preventDefault();
    if (
      busy ||
      !ids.length ||
      ids.length > 100 ||
      reason.trim().length < 10 ||
      (publicReason.trim() && publicReason.trim().length < 10)
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      setPreview({
        data: await operationsV3Service.previewBulk({
          reportIds: [...ids],
          action,
          reason: reason.trim(),
          ...(publicReason.trim() ? { publicReason: publicReason.trim() } : {}),
        }),
        key: crypto.randomUUID(),
      });
    } catch (failure) {
      setMessage(
        failure instanceof Error ? failure.message : 'Предпросмотр недоступен.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function execute() {
    if (!preview || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await operationsV3Service.executeBulk(preview.data.id, preview.key);
      setPreview(null);
      setReason('');
      setPublicReason('');
      onClear();
      onChanged();
      setMessage('Решение применено к зафиксированной выборке.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setPreview(null);
        setMessage(
          'Выборка изменилась или предпросмотр истёк. Создайте новый предпросмотр.',
        );
      } else
        setMessage(
          failure instanceof Error
            ? failure.message
            : 'Не удалось применить решение.',
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card form-stack">
      <h2>Решение по выбранным жалобам</h2>
      <p>
        Выбрано {ids.length} / 100. Предпросмотр фиксирует идентификаторы и
        число получателей; будущие жалобы не добавляются. Пользователи и контент
        не блокируются и не удаляются.
      </p>
      <button
        className="button secondary"
        onClick={onClear}
        disabled={busy || !ids.length}
      >
        Очистить выбор
      </button>
      <form className="form-stack" onSubmit={(event) => void create(event)}>
        <label>
          Решение
          <select
            value={action}
            onChange={(event) =>
              setAction(event.target.value as BulkPreview['action'])
            }
            disabled={busy || !!preview}
          >
            <option value="RESOLVE_REPORT">Завершить</option>
            <option value="REJECT_REPORT">Отклонить</option>
            <option value="NO_VIOLATION">Нарушения нет</option>
          </select>
        </label>
        <label>
          Внутреннее основание
          <textarea
            required
            minLength={10}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || !!preview}
          />
        </label>
        <label>
          Объяснение пользователю
          <textarea
            minLength={10}
            maxLength={1000}
            value={publicReason}
            onChange={(event) => setPublicReason(event.target.value)}
            disabled={busy || !!preview}
          />
        </label>
        <button
          className="button primary"
          disabled={
            busy ||
            !!preview ||
            !ids.length ||
            reason.trim().length < 10 ||
            (!!publicReason.trim() && publicReason.trim().length < 10)
          }
        >
          Предпросмотр решения
        </button>
      </form>
      {message && !preview && <p role="status">{message}</p>}
      <Dialog
        open={!!preview}
        title="Замороженная выборка жалоб"
        dismissDisabled={busy}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
      >
        {preview && (
          <>
            <p>
              {preview.data.count} жалоб · получателей результата:{' '}
              {preview.data.affectedUserCount}
            </p>
            <p>{preview.data.reason}</p>
            <p>
              Действует до{' '}
              {new Date(preview.data.expiresAt).toLocaleString('ru-RU')}
            </p>
            <details>
              <summary>Зафиксированные идентификаторы</summary>
              {preview.data.reportIds.map((id) => (
                <code key={id} style={{ display: 'block' }}>
                  {id}
                </code>
              ))}
            </details>
            <p className="data-note">
              Сервер повторно проверит актуальность. При сетевой ошибке повтор
              отправляет тот же ключ операции.
            </p>
            {message && <p role="alert">{message}</p>}
            <button
              className="button danger"
              onClick={() => void execute()}
              disabled={busy || Date.parse(preview.data.expiresAt) <= now}
            >
              {busy ? 'Применение…' : 'Применить к этой выборке'}
            </button>
          </>
        )}
      </Dialog>
    </section>
  );
}
