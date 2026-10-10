import { useCallback, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../features/admin-access/AdminContext';
import { usePolling } from '../hooks/usePolling';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/ui/Primitives';
import { DiagnosticsPanel } from '../components/dashboard/DiagnosticsPanel';
import { ApprovalsPanel } from '../components/moderation/ApprovalsPanel';
import {
  operationsV3Service,
  type OperationsIncident,
  type ReleaseComparison,
  type SettingChange,
  type SecuritySettingChange,
} from '../services/operations-v3.service';
import '../styles/operations-v2.css';
import '../styles/operations-v3.css';

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU') : 'Нет данных';
const metric = (value: number | null | undefined, suffix = '') =>
  value == null
    ? 'Нет измерений'
    : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}${suffix}`;
const incidentLabels: Record<OperationsIncident['status'], string> = {
  OPEN: 'Открыт',
  INVESTIGATING: 'Исследуется',
  MONITORING: 'Наблюдение',
  RESOLVED: 'Завершён',
};

export function OperationsPage() {
  const actor = useAdmin();
  const [params] = useSearchParams();
  const tabs = [
    ['incidents', 'Инциденты'],
    ...(actor.role !== 'MODERATOR'
      ? [
          ['backups', 'Резервные копии'],
          ['releases', 'Релизы'],
          ['settings', 'История настроек'],
          ['diagnostics', 'Диагностика'],
          ['approvals', 'Согласования'],
        ]
      : []),
  ];
  const requested = params.get('tab') || 'incidents';
  const tab = tabs.some(([id]) => id === requested) ? requested : 'incidents';
  return (
    <div className="operations-workspace">
      <PageHeader
        eyebrow="Рабочее место"
        title="Операции"
        description="Инциденты, восстановление, изменения и независимое согласование действий. Неизвестное состояние показывается отдельно от работоспособности."
      />
      <nav className="operations-tabs" aria-label="Разделы операций">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            to={`/admin/operations?tab=${id}`}
            aria-current={id === tab ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === 'incidents' && <IncidentBoard />}
      {tab === 'backups' && <BackupsPanel />}
      {tab === 'releases' && <ReleasesPanel />}
      {tab === 'settings' && <SettingsHistoryPanel />}
      {tab === 'diagnostics' && <DiagnosticsPanel />}
      {tab === 'approvals' && <ApprovalsPanel />}
    </div>
  );
}
function IncidentBoard() {
  const [params, setParams] = useSearchParams();
  const id = params.get('incident') || '';
  const state = usePolling(operationsV3Service.incidents, 30000);
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const affectedFunctions = String(data.get('functions'))
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!affectedFunctions.length || affectedFunctions.length > 8) {
      setError('Укажите от 1 до 8 функций через запятую.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await operationsV3Service.createIncident({
        title: String(data.get('title')).trim(),
        affectedFunctions,
        note: String(data.get('note')).trim(),
      });
      setCreate(false);
      setParams({ tab: 'incidents', incident: created.id });
      state.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Инцидент не создан.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="operations-toolbar">
        <button
          className="button secondary"
          disabled={state.loading}
          onClick={state.refresh}
        >
          Обновить инциденты
        </button>
        <button className="button primary" onClick={() => setCreate((x) => !x)}>
          Создать инцидент
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {create && (
        <form
          className="card form-stack"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Название
            <input
              name="title"
              minLength={5}
              maxLength={160}
              required
              disabled={busy}
            />
          </label>
          <label>
            Затронутые функции через запятую
            <input
              name="functions"
              required
              maxLength={640}
              disabled={busy}
              placeholder="Вход, сообщения"
            />
          </label>
          <label>
            Начальная запись
            <textarea
              name="note"
              minLength={10}
              maxLength={2000}
              required
              disabled={busy}
            />
          </label>
          <button className="button primary" disabled={busy}>
            Сохранить инцидент
          </button>
        </form>
      )}
      {state.error && (
        <p role="alert">
          {state.error}
          {state.data && ' Показан предыдущий снимок.'}
        </p>
      )}
      {id && <IncidentEditor key={id} id={id} onChanged={state.refresh} />}
      <section className="card operation-card">
        <h2>Рабочая доска инцидентов</h2>
        <p className="data-note">
          Повторные сигналы сгруппированы в инцидент; рабочий статус и
          восстановление автоматического сигнала — разные состояния.
        </p>
        {state.data ? (
          state.data.items.length ? (
            <div className="operations-grid">
              {state.data.items.map((item) => (
                <article className="card operation-card" key={item.id}>
                  <header>
                    <h3>{item.title}</h3>
                    <strong>{incidentLabels[item.status]}</strong>
                  </header>
                  <p>
                    {item.affectedFunctions.join(' · ') || 'Функции не указаны'}
                  </p>
                  <p>
                    Ответственный: {item.ownerName || 'Не назначен'} · сигналов:{' '}
                    {item.occurrences}
                  </p>
                  <p>
                    {item.source === 'SERVICE'
                      ? item.signalResolved
                        ? 'Сервисный сигнал восстановился'
                        : 'Сервисный сигнал ещё активен'
                      : 'Ручной инцидент'}
                  </p>
                <small>{date(item.updatedAt)}</small>
                {item.notificationId && <Link to="/admin/notifications">Связанные уведомления сервиса</Link>}
                  <Link
                    className="button secondary"
                    to={`/admin/operations?tab=incidents&incident=${encodeURIComponent(item.id)}`}
                  >
                    Открыть инцидент
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p>Инцидентов нет.</p>
          )
        ) : (
          <p>{state.loading ? 'Загрузка…' : 'Инциденты недоступны.'}</p>
        )}
      </section>
    </>
  );
}
function IncidentEditor({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const actor = useAdmin();
  const load = useCallback(
    (signal: AbortSignal) => operationsV3Service.incident(id, signal),
    [id],
  );
  const state = usePolling(load, 30000);
  const [status, setStatus] = useState<OperationsIncident['status'] | ''>('');
  const [claim, setClaim] = useState('KEEP');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!state.data || busy || note.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      await operationsV3Service.updateIncident(id, {
        expectedVersion: state.data.version,
        ...(status ? { status } : {}),
        ...(claim !== 'KEEP' ? { claim: claim === 'CLAIM' } : {}),
        note: note.trim(),
      });
      setNote('');
      setStatus('');
      setClaim('KEEP');
      state.refresh();
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Изменение не сохранено.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card operation-card">
      <h2>Карточка инцидента</h2>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data && (
        <>
          <h3>{state.data.title}</h3>
          <p>
            {incidentLabels[state.data.status]} · ответственный:{' '}
            {state.data.ownerName || 'Не назначен'} · версия{' '}
            {state.data.version}
          </p>
          <form className="form-stack" onSubmit={(event) => void submit(event)}>
            <label>
              Рабочий статус
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
                disabled={busy}
              >
                <option value="">Оставить текущий</option>
                {Object.entries(incidentLabels).map(([key, label]) => (
                  <option
                    key={key}
                    value={key}
                    disabled={
                      key === 'RESOLVED' &&
                      state.data?.source === 'SERVICE' &&
                      !state.data.signalResolved
                    }
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ответственность
              <select
                value={claim}
                onChange={(event) => setClaim(event.target.value)}
                disabled={busy}
              >
                <option value="KEEP">Без изменения</option>
                <option value="CLAIM">Взять на себя</option>
                <option
                  value="RELEASE"
                  disabled={state.data.ownerId !== actor.id}
                >
                  Снять с себя
                </option>
              </select>
            </label>
            <label>
              Запись в хронологию
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                minLength={10}
                maxLength={2000}
                required
                disabled={busy}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || note.trim().length < 10}
            >
              Сохранить запись и изменения
            </button>
          </form>
          {error && (
            <p role="alert">
              {error} Обновите карточку при конфликте версии; запись не
              теряется.
            </p>
          )}
          <ol className="operation-timeline">
            {state.data.timeline.map((event) => (
              <li key={event.id}>
                <strong>
                  {event.actorName || 'Система'} · {event.action}
                </strong>
                <p className="operation-reason">{event.body}</p>
                <small>{date(event.createdAt)}</small>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
function BackupsPanel() {
  const state = usePolling(operationsV3Service.backups, 60000);
  return (
    <section className="card operation-card">
      <header>
        <h2>Резервные копии и тест восстановления</h2>
        <button
          className="button secondary"
          disabled={state.loading}
          onClick={state.refresh}
        >
          Обновить копии
        </button>
      </header>
      {state.error && (
        <p role="alert">
          {state.error}
          {state.data && ' Показан предыдущий снимок.'}
        </p>
      )}
      {state.data ? (
        <>
          <p>
            {!state.data.configured
              ? 'Проверка не настроена'
              : {
                  HEALTHY: 'Подтверждено свежими успешными запусками',
                  DEGRADED: 'Проверка требует внимания',
                  DOWN: 'Зафиксирован сбой',
                  UNKNOWN: 'Нет подтверждённых данных',
                }[state.data.status]}
          </p>
          <dl className="operation-summary">
            <div>
              <dt>Последняя успешная копия</dt>
              <dd>{date(state.data.lastSuccess?.finishedAt || null)}</dd>
            </div>
            <div>
              <dt>Последний тест восстановления</dt>
              <dd>
                {state.data.lastRestoreTest
                  ? `${state.data.lastRestoreTest.status} · ${date(state.data.lastRestoreTest.finishedAt)}`
                  : 'Нет данных'}
              </dd>
            </div>
            <div>
              <dt>Допустимый возраст</dt>
              <dd>
                Копия: {state.data.maxBackupAgeHours} ч · тест восстановления:{' '}
                {state.data.maxRestoreAgeDays} дн.
              </dd>
            </div>
          </dl>
          <p className="data-note">
            Успешная копия и проверенное восстановление оцениваются отдельно.
            Страница показывает зарегистрированные запуски и не запускает
            восстановление production.
          </p>
          <div className="operations-scroll">
            <table>
              <thead>
                <tr>
                  <th>Тип / состояние</th>
                  <th>Начало / конец</th>
                  <th>Длительность / размер</th>
                  <th>Проверка / код ошибки</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((run) => (
                  <tr key={run.id}>
                    <td>
                      {run.kind === 'BACKUP' ? 'Копия' : 'Тест восстановления'}{' '}
                      · {run.status}
                    </td>
                    <td>
                      {date(run.startedAt)}
                      <br />
                      {date(run.finishedAt)}
                    </td>
                    <td>
                      {metric(run.durationMs, ' мс')}
                      <br />
                      {metric(run.bytes, ' байт')}
                    </td>
                    <td>
                      <code>
                        {run.digest || 'Контрольная сумма неизвестна'}
                      </code>
                      {run.errorCode && <p>Код ошибки: {run.errorCode}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!state.data.items.length && (
            <p>Зарегистрированных запусков пока нет.</p>
          )}
        </>
      ) : (
        <p>{state.loading ? 'Загрузка…' : 'Статус копий недоступен.'}</p>
      )}
    </section>
  );
}
function ReleasesPanel() {
  const [windowMinutes, setWindow] = useState<15 | 60>(15);
  const [releaseId, setRelease] = useState('');
  const state = useAsync(
    (signal) => operationsV3Service.releases(windowMinutes, releaseId, signal),
    [windowMinutes, releaseId],
  );
  return (
    <section className="card operation-card">
      <h2>Версии и показатели до / после</h2>
      <div className="operations-toolbar">
        <label>
          Окно сравнения
          <select
            value={windowMinutes}
            onChange={(event) =>
              setWindow(Number(event.target.value) as 15 | 60)
            }
          >
            <option value={15}>15 минут</option>
            <option value={60}>60 минут</option>
          </select>
        </label>
        {state.data && (
          <label>
            Релиз
            <select
              value={releaseId || state.data.selectedReleaseId || ''}
              onChange={(event) => setRelease(event.target.value)}
            >
              {state.data.items.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.service} ·{' '}
                  {release.revision?.slice(0, 12) || 'ревизия неизвестна'} ·{' '}
                  {date(release.startedAt)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data && (
        <>
          <div className="operations-grid">
            {state.data.items.map((release) => (
              <article className="card" key={release.id}>
                <h3>{release.service}</h3>
                <p>
                  Ревизия: <code>{release.revision || 'Неизвестна'}</code>
                </p>
                <details>
                  <summary>Образ</summary>
                  <code>{release.imageId}</code>
                </details>
                <small>
                  Начало {date(release.startedAt)} · обнаружено{' '}
                  {date(release.observedAt)}
                </small>
              </article>
            ))}
          </div>
          {!state.data.items.length && <p>Версии пока не зарегистрированы.</p>}
          <div className="operations-grid">
            <Comparison title="До релиза" data={state.data.before} />
            <Comparison title="После релиза" data={state.data.after} />
          </div>
          <p className="data-note">
            Сравнение отражает наблюдения в выбранных временных окнах; различия
            сами по себе не доказывают влияние релиза. Отсутствующие замеры не
            равны нулю.
          </p>
          <ul>
            {state.data.limitations.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
function Comparison({
  title,
  data,
}: {
  title: string;
  data: ReleaseComparison | null;
}) {
  return (
    <article className="card operation-card">
      <h3>{title}</h3>
      {data ? (
        <>
          <p>
            {date(data.from)} — {date(data.to)}
          </p>
          {!data.complete && (
            <p className="coverage-warning">Окно покрыто не полностью.</p>
          )}
          <div className="operations-scroll">
            <table>
              <thead>
                <tr>
                  <th>Процесс</th>
                  <th>Выборка / ошибки</th>
                  <th>Ошибки, %</th>
                  <th>p95 / среднее, мс</th>
                </tr>
              </thead>
              <tbody>
                {data.operations.map((item) => (
                  <tr key={item.operationId}>
                    <td>{item.operationId}</td>
                    <td>
                      {item.count} / {item.errors}
                    </td>
                    <td>
                      {metric(
                        item.errorRate == null ? null : item.errorRate * 100,
                        '%',
                      )}
                    </td>
                    <td>
                      {metric(item.p95Ms)} / {metric(item.meanMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Транспорты звонков</h4>
          {data.calls.map((call) => (
            <div key={call.mode}>
              <strong>{call.mode}</strong>
              <p>
                Подключения / ошибки / разрывы: {call.connects} /{' '}
                {call.failures} / {call.disconnects}
              </p>
              <p>
                Замеры: {call.samples} · потери{' '}
                {metric(call.packetLossPercent, '%')} · RTT{' '}
                {metric(call.rttMs, ' мс')} · jitter{' '}
                {metric(call.jitterMs, ' мс')}
              </p>
            </div>
          ))}
        </>
      ) : (
        <p>Данных для окна нет.</p>
      )}
    </article>
  );
}
function SettingsHistoryPanel() {
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => operationsV3Service.settings(signal),
    [reload],
  );
  const [selected, setSelected] = useState<SettingChange | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function rollback(event: FormEvent) {
    event.preventDefault();
    if (!selected || !state.data || busy || reason.trim().length < 10) return;
    setBusy(true);
    setMessage('');
    try {
      await operationsV3Service.rollback(
        selected.id,
        state.data.version,
        reason.trim(),
      );
      setSelected(null);
      setReason('');
      setReload((x) => x + 1);
      setMessage('Настройки восстановлены новым аудируемым изменением.');
    } catch (failure) {
      setMessage(
        failure instanceof Error ? failure.message : 'Откат не выполнен.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card operation-card">
      <header>
        <h2>История настроек</h2>
        <Link className="button secondary" to="/admin/thresholds">
          Текущие пороги
        </Link>
      </header>
      <p className="data-note">
        Откат доступен только для актуального последнего изменения, если
        настройки после него не изменялись. История не удаляется.
      </p>
      {(state.error || message) && (
        <p role="status">{state.error || message}</p>
      )}
      {state.data && (
        <>
          <p>Текущая версия: {state.data.version}</p>
          {!state.data.items.length && <p>Изменений пока нет.</p>}
          {state.data.items.map((change) => (
            <article className="card operation-card" key={change.id}>
              <header>
                <h3>Версия {change.version}</h3>
                <small>
                  {change.actorName} · {date(change.createdAt)}
                </small>
              </header>
              <p className="operation-reason">{change.reason}</p>
              {change.revertedFrom && (
                <p>Откат изменения {change.revertedFrom}</p>
              )}
              <details>
                <summary>Значения до и после</summary>
                <div className="operations-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Процесс</th>
                        <th>До: вкл / p95 / ошибки / выборка</th>
                        <th>После: вкл / p95 / ошибки / выборка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {change.after.map((after) => {
                        const before = change.before.find(
                          (item) => item.operationId === after.operationId,
                        );
                        const format = (value: typeof after | undefined) =>
                          value
                            ? `${value.enabled ? 'Да' : 'Нет'} / ${value.p95Ms} мс / ${(value.errorRate * 100).toFixed(2)}% / ${value.minSamples}`
                            : 'Нет данных';
                        return (
                          <tr key={after.operationId}>
                            <td>{after.operationId}</td>
                            <td>{format(before)}</td>
                            <td>{format(after)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
              <button
                className="button secondary"
                disabled={!change.canRollback || busy}
                onClick={() => {
                  setSelected(change);
                  setReason('');
                  setMessage('');
                }}
              >
                Подготовить откат
              </button>
            </article>
          ))}
          <h3>Изменения доступа сотрудников</h3>
          <p className="data-note">
            История прав и отключений доступна только для просмотра. Откат
            паролей, ролей и двухфакторной защиты здесь недоступен.
          </p>
          {state.data.securityChanges?.length ? (
            state.data.securityChanges.map((change) => (
              <SecurityChange key={change.id} change={change} />
            ))
          ) : (
            <p>Записей об изменениях доступа пока нет.</p>
          )}
        </>
      )}
      {selected && (
        <form
          className="card form-stack"
          onSubmit={(event) => void rollback(event)}
        >
          <h3>Вернуть значения перед версией {selected.version}</h3>
          <label>
            Причина отката
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
            className="button danger"
            disabled={busy || reason.trim().length < 10}
          >
            Подтвердить откат
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setSelected(null)}
          >
            Отмена
          </button>
        </form>
      )}
    </section>
  );
}
function SecurityChange({ change }: { change: SecuritySettingChange }) {
  const keys = [
    ...new Set([
      ...Object.keys(change.before || {}),
      ...Object.keys(change.after || {}),
    ]),
  ];
  const value = (entry: unknown) =>
    entry == null
      ? 'Не записано'
      : typeof entry === 'boolean'
        ? entry
          ? 'Да'
          : 'Нет'
        : typeof entry === 'string' || typeof entry === 'number'
          ? String(entry)
          : Array.isArray(entry)
            ? entry.join(', ')
            : 'Структурированное значение';
  return (
    <article className="card operation-card">
      <h4>{change.action}</h4>
      <small>
        {change.actorName} · {date(change.createdAt)}
      </small>
      <p>{change.reason || 'Причина не указана'}</p>
      {!change.before && !change.after ? (
        <p>Значения до и после раньше не записывались.</p>
      ) : (
        <div className="operations-scroll">
          <table>
            <thead>
              <tr>
                <th>Поле</th>
                <th>До</th>
                <th>После</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td>{value(change.before?.[key])}</td>
                  <td>{value(change.after?.[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
