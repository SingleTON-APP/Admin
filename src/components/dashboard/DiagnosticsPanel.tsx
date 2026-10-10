import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/contracts';
import {
  operationsV3Service,
  type DiagnosticTrace,
} from '../../services/operations-v3.service';

export function DiagnosticsPanel() {
  const [code, setCode] = useState('');
  const [trace, setTrace] = useState<DiagnosticTrace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = code.trim();
    if (
      !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
        value,
      )
    ) {
      setError('Введите UUID кода ошибки, показанного пользователю.');
      return;
    }
    setBusy(true);
    setTrace(null);
    setError('');
    try {
      setTrace(await operationsV3Service.diagnostic(value));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 404
          ? 'Код не найден: ошибка могла не попасть в ограниченный сбор, срок хранения мог истечь или код указан неверно.'
          : failure instanceof Error
            ? failure.message
            : 'Диагностика недоступна.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card operation-card">
      <h2>Поиск ошибки по коду</h2>
      <p className="data-note">
        Код связывает обращение пользователя с сохранённым серверным HTTP-сбоем.
        Доставка сообщения и действия браузера не восстанавливаются
        предположением.
      </p>
      <form
        className="operations-toolbar"
        onSubmit={(event) => void search(event)}
      >
        <label>
          Код ошибки
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
            disabled={busy}
            required
            maxLength={64}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? 'Поиск…' : 'Найти ошибку'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {trace && (
        <>
          <dl className="operation-summary">
            <div>
              <dt>Код</dt>
              <dd>{trace.code}</dd>
            </div>
            <div>
              <dt>Зафиксировано</dt>
              <dd>{new Date(trace.occurredAt).toLocaleString('ru-RU')}</dd>
            </div>
            <div>
              <dt>Хранение</dt>
              <dd>
                {trace.retentionDays} дней, до{' '}
                {new Date(trace.expiresAt).toLocaleString('ru-RU')}
              </dd>
            </div>
          </dl>
          <p className="coverage-warning">
            Доступен только сохранённый HTTP-сбой сервера. Цепочка доставки
            сообщения недоступна; клиентский код служит ссылкой, а не измерением
            полного пользовательского сценария.
          </p>
          <p className="data-note">Этапы обработки в контексте этого запроса: {trace.coverage.processStages === 'OBSERVED' ? 'Есть наблюдения' : 'Не наблюдались'}.</p>
          <ol className="operation-timeline">
            {trace.timeline.map((entry, index) => (
              <li key={`${entry.startedAt}-${index}`}>
                <strong>
                  {entry.service} ·{' '}
                  {entry.stage === 'HTTP_REQUEST'
                    ? `${entry.method} ${entry.routeTemplate}`
                    : entry.operation}
                </strong>
                <p>
                  {entry.stage === 'HTTP_REQUEST'
                    ? `HTTP ${entry.status}`
                    : entry.failed
                      ? 'Ошибка этапа'
                      : 'Этап завершён'}{' '}
                  ·{' '}
                  {entry.durationMs == null
                    ? 'Длительность не измерена'
                    : `${entry.durationMs.toLocaleString('ru-RU')} мс`}
                </p>
                <small>
                  {new Date(entry.startedAt).toLocaleString('ru-RU')} →{' '}
                  {new Date(entry.finishedAt).toLocaleString('ru-RU')}
                </small>
              </li>
            ))}
          </ol>
          {trace.limitations.length > 0 && (
            <ul>
              {trace.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
