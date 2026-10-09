import { useState } from 'react';
import type {
  ProcessOperation,
  ProcessSnapshot,
} from '../../services/process-metrics.service';
import '../../styles/process-metrics.css';

const labels: Record<string, [string, string]> = {
  'login.server': [
    'Вход',
    'HTTP-запрос входа на сервисе авторизации, включая ошибки. Не весь сценарий с вводом кода.',
  ],
  'registration.server': [
    'Регистрация',
    'HTTP-запрос регистрации на сервисе авторизации. Ввод кода пользователем не включён.',
  ],
  'message.client': [
    'Сообщение · запрос с сайта',
    'От отправки HTTP-запроса до ответа сервером: сеть + обработка. Не доставка собеседнику.',
  ],
  'message.server': [
    'Сообщение · сервер',
    'Обработчик после проверки авторизации. Передача запроса по сети не включена.',
  ],
  'message.persistence': [
    'Сообщение · сохранение',
    'Транзакция, блокировки, запросы и загрузка связей. Не только выполнение SQL.',
  ],
  'message.fanout': [
    'Сообщение · рассылка',
    'Поиск получателей, счётчики непрочитанного и отправка события. Не подтверждение получения.',
  ],
  'message.receiver_ack_rtt': [
    'Сообщение · подтверждение',
    'От отправки события до ACK приложения онлайн-получателя и обратно. Не односторонняя задержка, прочтение или ожидание офлайна. Считаются подтверждения событий по соединениям: несколько вкладок могут дать несколько замеров.',
  ],
  'call.connection.client': [
    'Звонок · соединение',
    'Первое соединение локального WebRTC после начала подключения. Не гудки и не оценка качества разговора.',
  ],
};
const colors = [
  '#2563eb',
  '#9333ea',
  '#0891b2',
  '#dc2626',
  '#d97706',
  '#059669',
  '#db2777',
  '#475569',
];
const title = (id: string) => labels[id]?.[0] ?? id;
const number = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const time = (value: string, history = false) =>
  history
    ? new Date(value).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : new Date(value).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
const authSourceStatus: Record<string, string> = {
  UNKNOWN: 'проверка источника ещё не выполнена',
  UNCONFIGURED: 'источник не настроен',
  NOT_INSTRUMENTED: 'сбор ещё не подключён',
  STALE: 'данные источника устарели',
  UNAVAILABLE: 'не удалось обновить источник',
};

export function ProcessComparison({
  operations,
  selected,
  quantile,
  history = false,
}: {
  operations: ProcessOperation[];
  selected: string[];
  quantile: 'p50Ms' | 'p95Ms';
  history?: boolean;
}) {
  const chosen = operations.filter((operation) =>
    selected.includes(operation.id),
  );
  const timestamps = [
    ...new Set(
      chosen.flatMap((operation) =>
        operation.series.map((point) => point.timestamp),
      ),
    ),
  ].sort();
  const values = chosen
    .flatMap((operation) => operation.series.map((point) => point[quantile]))
    .filter(
      (value): value is number => value != null && Number.isFinite(value),
    );
  if (!values.length)
    return (
      <p className="data-note">
        Для выбранных процессов пока нет замеров задержки. Пропуски не
        заменяются нулями.
      </p>
    );
  const max = Math.max(1, ...values);
  const x = (index: number) =>
    64 + (timestamps.length <= 1 ? 0.5 : index / (timestamps.length - 1)) * 566;
  const y = (value: number) => 172 - (value / max) * 148;
  return (
    <svg
      className="process-chart"
      viewBox="0 0 650 208"
      role="img"
      aria-label={`Сравнение процессов: ${quantile === 'p95Ms' ? 'p95' : 'p50'}, миллисекунды. Точные значения доступны ниже.`}
    >
      {[0, max / 2, max].map((value) => (
        <g key={value}>
          <line
            x1="64"
            x2="630"
            y1={y(value)}
            y2={y(value)}
            className="chart-axis"
          />
          <text x="56" y={y(value) + 4} textAnchor="end" className="chart-tick">
            {number(value)}
          </text>
        </g>
      ))}
      <text x="8" y="12" className="chart-tick">
        мс
      </text>
      {chosen.map((operation) => {
        const segments: string[][] = [[]];
        const points = timestamps.map((timestamp) =>
          operation.series.find((point) => point.timestamp === timestamp),
        );
        points.forEach((point, index) => {
          const value = point?.[quantile];
          if (value == null || !Number.isFinite(value)) {
            if (segments.at(-1)!.length) segments.push([]);
          } else segments.at(-1)!.push(`${x(index)},${y(value)}`);
        });
        const color = colors[operations.indexOf(operation) % colors.length];
        return (
          <g key={operation.id} stroke={color} fill={color}>
            {segments
              .filter((segment) => segment.length > 1)
              .map((segment, index) => (
                <polyline
                  key={index}
                  points={segment.join(' ')}
                  fill="none"
                  strokeWidth="2"
                />
              ))}
            {points.map((point, index) =>
              point?.[quantile] != null && Number.isFinite(point[quantile]) ? (
                <circle
                  key={index}
                  cx={x(index)}
                  cy={y(point[quantile]!)}
                  r="3"
                >
                  <title>
                    {title(operation.id)} · {time(point.timestamp, history)} ·{' '}
                    {number(point[quantile])} мс · {point.durationSamples}{' '}
                    замеров
                  </title>
                </circle>
              ) : null,
            )}
          </g>
        );
      })}
      {[
        ...new Set([
          0,
          Math.floor((timestamps.length - 1) / 2),
          timestamps.length - 1,
        ]),
      ].map((index) => (
        <text
          key={index}
          x={x(index)}
          y="200"
          textAnchor={
            index === 0
              ? 'start'
              : index === timestamps.length - 1
                ? 'end'
                : 'middle'
          }
          className="chart-tick"
        >
          {time(timestamps[index]!, history)}
        </text>
      ))}
    </svg>
  );
}

export function ProcessMetricsPanel({
  snapshot,
  history = false,
}: {
  snapshot: ProcessSnapshot;
  history?: boolean;
}) {
  const [selected, setSelected] = useState([
    'login.server',
    'registration.server',
    'message.server',
    'message.persistence',
    'message.receiver_ack_rtt',
    'call.connection.client',
  ]);
  const [quantile, setQuantile] = useState<'p50Ms' | 'p95Ms'>('p95Ms');
  const auth = snapshot.sources?.auth;
  return (
    <div className="process-panel">
      <p className="data-note">
        Реальные замеры {history ? 'по часам · UTC' : 'по минутам'}. p50 —
        обычная задержка, p95 — граница для 95% замеров, оценённая по корзинам
        гистограммы. Время в миллисекундах.
      </p>
      {auth && auth.status !== 'AVAILABLE' && (
        <p className="health-stale" role="status">
          Метрики авторизации:{' '}
          {authSourceStatus[auth.status] ?? 'состояние источника неизвестно'}.{' '}
          {auth.lastSuccessAt
            ? `Последний сбор: ${new Date(auth.lastSuccessAt).toLocaleString('ru-RU')}. История сохранена.`
            : 'Успешного сбора ещё не было.'}
        </p>
      )}
      <div className="process-controls">
        <label>
          На графике{' '}
          <select
            aria-label="Задержка на графике процессов"
            value={quantile}
            onChange={(event) =>
              setQuantile(event.target.value as 'p50Ms' | 'p95Ms')
            }
          >
            <option value="p95Ms">p95</option>
            <option value="p50Ms">p50</option>
          </select>
        </label>
      </div>
      <fieldset className="process-legend">
        <legend>Сравнить процессы</legend>
        {snapshot.operations.map((operation, index) => (
          <label
            key={operation.id}
            style={{ borderColor: colors[index % colors.length] }}
          >
            <input
              type="checkbox"
              checked={selected.includes(operation.id)}
              onChange={(event) =>
                setSelected((previous) =>
                  event.target.checked
                    ? [...previous, operation.id]
                    : previous.filter((id) => id !== operation.id),
                )
              }
            />
            {title(operation.id)}
          </label>
        ))}
      </fieldset>
      <ProcessComparison
        operations={snapshot.operations}
        selected={selected}
        quantile={quantile}
        history={history}
      />
      <div className="process-summary">
        {snapshot.operations.map((operation) => (
          <article key={operation.id}>
            <h3>{title(operation.id)}</h3>
            <p className="data-note">{labels[operation.id]?.[1]}</p>
            {operation.availability === 'NOT_INSTRUMENTED' ? (
              <strong>Сбор не подключён</strong>
            ) : operation.count === 0 ? (
              <strong>Нет замеров за период</strong>
            ) : (
              <>
                <dl>
                  <div>
                    <dt>p50 / p95</dt>
                    <dd>
                      {number(operation.p50Ms)} / {number(operation.p95Ms)} мс
                    </dd>
                  </div>
                  <div>
                    <dt>Операции / замеры задержки</dt>
                    <dd>
                      {number(operation.count)} /{' '}
                      {number(operation.durationSamples)}
                    </dd>
                  </div>
                  <div>
                    <dt>Ошибки</dt>
                    <dd>
                      {number(operation.errors)} (
                      {number(
                        operation.errorRate == null
                          ? null
                          : operation.errorRate * 100,
                      )}
                      %)
                    </dd>
                  </div>
                </dl>
                {operation.durationSamples === 0 && (
                  <p className="data-note">
                    Есть исходы операций, но задержка не измерена.
                  </p>
                )}
              </>
            )}
            <small>
              {operation.source === 'client-reported'
                ? 'Измерено приложением пользователя'
                : operation.source === 'auth-service'
                  ? 'Сервис авторизации'
                  : 'Сервер Hub'}
            </small>
          </article>
        ))}
      </div>
      <details className="chart-data">
        <summary>Точные значения {history ? 'по часам' : 'по минутам'}</summary>
        <div className="chart-table-wrap">
          <table>
            <caption>
              Только интервалы с операциями; пустые интервалы означают
              отсутствие замеров
            </caption>
            <thead>
              <tr>
                <th>Время</th>
                <th>Процесс</th>
                <th>Операции</th>
                <th>Ошибки</th>
                <th>p50, мс</th>
                <th>p95, мс</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.operations.flatMap((operation) =>
                operation.series
                  .filter((point) => point.count > 0)
                  .map((point) => (
                    <tr key={`${operation.id}-${point.timestamp}`}>
                      <td>{time(point.timestamp, history)}</td>
                      <th scope="row">{title(operation.id)}</th>
                      <td>{point.count}</td>
                      <td>{point.errors}</td>
                      <td>{number(point.p50Ms)}</td>
                      <td>{number(point.p95Ms)}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      </details>
      <p className="data-note">
        {history
          ? 'Почасовая история сохранена в базе; p95 получен объединением гистограмм, а не усреднением процентилей. Начало'
          : 'Окно до 60 минут, данные текущего экземпляра сервера. Перезапуск очищает оперативные замеры процессов; долговременная история хранится в базе. Начало'}
        сбора: {new Date(snapshot.startedAt).toLocaleString('ru-RU')}. Значения
        этапов могут перекрываться: складывать их нельзя.
      </p>
    </div>
  );
}
