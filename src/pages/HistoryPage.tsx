import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import {
  operationsService,
  type Coverage,
} from '../services/operations-v2.service';
import { ProcessMetricsPanel } from '../components/dashboard/ProcessMetricsPanel';
import { HistoryTrend } from '../components/dashboard/HistoryTrend';
import { PageHeader } from '../components/ui/Primitives';
import '../styles/operations-v2.css';

export function CoverageNotice({ coverage }: { coverage: Coverage }) {
  return (
    <p className={coverage.partial ? 'coverage-warning' : 'data-note'}>
      История в БД · {new Date(coverage.from).toLocaleString('ru-RU')} —{' '}
      {new Date(coverage.to).toLocaleString('ru-RU')}.{' '}
      {coverage.availableFrom
        ? `Сбор с ${new Date(coverage.availableFrom).toLocaleString('ru-RU')}.`
        : 'Сохранённых измерений пока нет.'}{' '}
      {coverage.partial &&
        'Выбранный период покрыт частично; пропуски не означают нулевые значения.'}{' '}
      Хранение: {coverage.retentionDays} дней; запись каждые{' '}
      {coverage.flushIntervalSeconds} с.
    </p>
  );
}
export function HistoryPage() {
  const [days, setDays] = useState<7 | 30>(7);
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Мониторинг"
        title="История метрик"
        description="Сохранённые измерения переживают перезапуски сервера."
        actions={
          <Link className="button secondary" to="/admin/monitor">
            Живой экран
          </Link>
        }
      />
      <label>
        Период{' '}
        <select
          aria-label="Период истории"
          value={days}
          onChange={(event) => setDays(Number(event.target.value) as 7 | 30)}
        >
          <option value={7}>7 дней</option>
          <option value={30}>30 дней</option>
        </select>
      </label>
      <HistoryBoard key={days} days={days} />
    </div>
  );
}
function HistoryBoard({ days }: { days: 7 | 30 }) {
  const [serviceId, setServiceId] = useState('');
  const load = useCallback(
    (signal: AbortSignal) => operationsService.history(days, signal),
    [days],
  );
  const servicesLoad = useCallback(
    (signal: AbortSignal) => operationsService.serviceHistory(days, signal),
    [days],
  );
  const state = usePolling(load, 60000);
  const services = usePolling(servicesLoad, 60000);
  const incidentsLoad = useCallback(
    (signal: AbortSignal) => operationsService.incidents(days, signal),
    [days],
  );
  const incidents = usePolling(incidentsLoad, 60000);
  return (
    <>
      <div className="operations-controls">
        <button
          className="button secondary"
          disabled={state.loading || services.loading || incidents.loading}
          onClick={() => {
            state.refresh();
            services.refresh();
            incidents.refresh();
          }}
        >
          Обновить историю
        </button>
        {state.error && (
          <p role="alert">
            {state.error} {state.data && 'Показан предыдущий снимок.'}
          </p>
        )}
      </div>
      {state.data ? (
        <section className="card">
          <CoverageNotice coverage={state.data.coverage} />
          <ProcessMetricsPanel
            history
            snapshot={{
              generatedAt: state.data.generatedAt || state.data.coverage.to,
              startedAt:
                state.data.coverage.availableFrom || state.data.coverage.from,
              operations: state.data.operations,
            }}
          />
        </section>
      ) : (
        <p>{state.loading ? 'Загрузка истории…' : 'История недоступна.'}</p>
      )}
      <section className="card">
        <h2>Проверки сервисов</h2>
        {services.error && (
          <p role="alert">
            {services.error} {services.data && 'Показаны предыдущие проверки.'}
          </p>
        )}
        {services.data ? (
          <>
            <CoverageNotice coverage={services.data.coverage} />
            <label>
              Сервис{' '}
              <select
                aria-label="Сервис в истории"
                value={serviceId || services.data.services[0]?.id || ''}
                onChange={(event) => setServiceId(event.target.value)}
              >
                {services.data.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            {services.data.services
              .filter(
                (service) =>
                  service.id === (serviceId || services.data?.services[0]?.id),
              )
              .map((service) => (
                <HistoryTrend
                  key={service.id}
                  label={`Задержка · ${service.name}`}
                  unit="мс"
                  points={service.series.map((point) => ({
                    timestamp: point.timestamp,
                    value: point.latencyMs,
                  }))}
                />
              ))}
            <div className="operations-scroll">
              <table>
                <caption>
                  Почасовые выборки · UTC. В минуте сохраняется последняя
                  проверка; час показывает худшее сохранённое состояние и
                  среднюю задержку. UNKNOWN означает неизвестное состояние.
                </caption>
                <thead>
                  <tr>
                    <th>Сервис</th>
                    <th>Время</th>
                    <th>Состояние</th>
                    <th>Задержка, мс</th>
                    <th>Минутные выборки / DOWN</th>
                  </tr>
                </thead>
                <tbody>
                  {services.data.services
                    .filter(
                      (service) =>
                        service.id ===
                        (serviceId || services.data?.services[0]?.id),
                    )
                    .flatMap((service) =>
                      service.series.map((point) => (
                        <tr key={`${service.id}-${point.timestamp}`}>
                          <th>{service.name}</th>
                          <td>
                            {new Date(point.timestamp).toLocaleString('ru-RU', {
                              timeZone: 'UTC',
                            })}
                          </td>
                          <td>
                            {
                              {
                                HEALTHY: 'Работает',
                                DEGRADED: 'Сбои',
                                DOWN: 'Недоступен',
                                UNKNOWN: 'Нет данных',
                              }[point.status]
                            }
                          </td>
                          <td>
                            {point.latencyMs == null
                              ? 'Нет измерений'
                              : point.latencyMs.toLocaleString('ru-RU')}
                          </td>
                          <td>
                            {point.checks} / {point.downChecks}
                          </td>
                        </tr>
                      )),
                    )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>
            {services.loading ? 'Загрузка проверок…' : 'Нет данных проверок.'}
          </p>
        )}
      </section>
      <section className="card">
        <h2>История инцидентов</h2>
        <p className="data-note">
          Длительность считается от обнаружения до восстановления или последней
          выборки. Проверки выполняются периодически: это не точное время начала
          и конца простоя. Включены продолжающиеся инциденты, начавшиеся раньше
          выбранного периода.
        </p>
        {incidents.error && (
          <p role="alert">
            {incidents.error}{' '}
            {incidents.data && 'Показан предыдущий снимок инцидентов.'}
          </p>
        )}
        {incidents.data ? (
          <>
            <p className="data-note">
              До {incidents.data.limit} последних инцидентов · снимок{' '}
              {new Date(incidents.data.generatedAt).toLocaleString('ru-RU')}
            </p>
            {incidents.data.items.length ? (
              <div className="operations-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Инцидент</th>
                      <th>Состояние</th>
                      <th>Обнаружен</th>
                      <th>Длительность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.data.items.map((incident) => (
                      <tr key={incident.id}>
                        <td>
                          <strong>{incident.title}</strong>
                          <p>{incident.message}</p>
                          <small>
                            {incident.metadata.operationId ||
                              incident.metadata.serviceId ||
                              'Сервис'}{' '}
                            · повторов: {incident.occurrences}
                          </small>
                        </td>
                        <td>
                          {incident.resolvedAt ? 'Завершён' : 'Продолжается'}
                        </td>
                        <td>
                          {new Date(incident.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td>
                          {Math.floor(incident.durationSeconds / 3600)} ч{' '}
                          {Math.floor((incident.durationSeconds % 3600) / 60)}{' '}
                          мин {Math.floor(incident.durationSeconds % 60)} с
                          {incident.resolvedAt && (
                            <small>
                              <br />
                              Восстановление:{' '}
                              {new Date(incident.resolvedAt).toLocaleString(
                                'ru-RU',
                              )}
                            </small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Инцидентов за выбранный период нет.</p>
            )}
          </>
        ) : (
          <p>
            {incidents.loading
              ? 'Загрузка инцидентов…'
              : 'История инцидентов недоступна.'}
          </p>
        )}
      </section>
    </>
  );
}
