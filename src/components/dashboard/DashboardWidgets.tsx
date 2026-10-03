import { Link } from 'react-router-dom';
import type {
  DashboardStatusItem,
  DashboardTrendPoint,
  ReportTargetType,
} from '../../types/domain';

const number = (value: number) => value.toLocaleString('ru-RU');
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Дата неизвестна'
    : parsed.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
};

export function TrendChart({
  points,
  label,
  secondaryLabel,
}: {
  points: DashboardTrendPoint[];
  label: string;
  secondaryLabel?: string;
}) {
  if (!points.length)
    return <p className="data-note">За выбранный период данных нет.</p>;
  const width = 640;
  const height = 210;
  const left = 48;
  const right = 618;
  const top = 18;
  const bottom = 172;
  const values = points
    .flatMap((point) => [
      point.count,
      ...(secondaryLabel && point.secondary !== undefined
        ? [point.secondary]
        : []),
    ])
    .filter(Number.isFinite);
  const maximum = Math.max(1, ...values);
  const step = 10 ** Math.floor(Math.log10(maximum));
  const max = Math.ceil(maximum / step) * step;
  const x = (index: number) =>
    points.length === 1
      ? (left + right) / 2
      : left + (index / (points.length - 1)) * (right - left);
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  const segments = (key: 'count' | 'secondary') => {
    const result: string[][] = [[]];
    points.forEach((point, index) => {
      const value = point[key];
      if (value === undefined || !Number.isFinite(value)) {
        if (result.at(-1)!.length) result.push([]);
      } else result.at(-1)!.push(`${x(index)},${y(value)}`);
    });
    return result.filter((segment) => segment.length > 1);
  };
  const ticks = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];
  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}. Точные значения доступны в таблице под графиком.`}
      >
        <title>{label}</title>
        {[0, max / 2, max].map((value) => (
          <g key={value}>
            <line
              x1={left}
              y1={y(value)}
              x2={right}
              y2={y(value)}
              className="chart-axis"
            />
            <text
              x={left - 8}
              y={y(value) + 4}
              textAnchor="end"
              className="chart-tick"
            >
              {number(value)}
            </text>
          </g>
        ))}
        {segments('count').map((segment, index) => (
          <polyline
            key={index}
            points={segment.join(' ')}
            className="chart-line chart-line-primary"
          />
        ))}
        {secondaryLabel &&
          segments('secondary').map((segment, index) => (
            <polyline
              key={index}
              points={segment.join(' ')}
              className="chart-line chart-line-secondary"
            />
          ))}
        {points.flatMap((point, index) =>
          (
            ['count', ...(secondaryLabel ? ['secondary'] : [])] as Array<
              'count' | 'secondary'
            >
          ).map((key) => {
            const value = point[key];
            if (value === undefined || !Number.isFinite(value)) return null;
            const description = `${date(point.date)}: ${key === 'count' ? label : secondaryLabel} — ${number(value)}`;
            return (
              <circle
                key={`${index}-${key}`}
                cx={x(index)}
                cy={y(value)}
                r="4"
                tabIndex={0}
                role="img"
                aria-label={description}
                className={`chart-point chart-point-${key === 'count' ? 'primary' : 'secondary'}`}
              >
                <title>{description}</title>
              </circle>
            );
          }),
        )}
        {ticks.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 10}
            textAnchor={
              points.length === 1
                ? 'middle'
                : index === 0
                  ? 'start'
                  : index === points.length - 1
                    ? 'end'
                    : 'middle'
            }
            className="chart-tick"
          >
            {date(points[index]!.date)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <i />
        {label}
        {secondaryLabel && (
          <>
            <i className="secondary" />
            {secondaryLabel}
          </>
        )}
      </div>
      <details className="chart-data">
        <summary>Точные значения по дням</summary>
        <div className="chart-table-wrap">
          <table>
            <caption>{label}: данные за выбранный период</caption>
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">{label}</th>
                {secondaryLabel && <th scope="col">{secondaryLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={`${point.date}-${index}`}>
                  <th scope="row">{date(point.date)}</th>
                  <td>
                    {Number.isFinite(point.count)
                      ? number(point.count)
                      : 'Нет данных'}
                  </td>
                  {secondaryLabel && (
                    <td>
                      {point.secondary === undefined ||
                      !Number.isFinite(point.secondary)
                        ? 'Нет данных'
                        : number(point.secondary)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

const targetLabels: Record<ReportTargetType, string> = {
  USER: 'Пользователи',
  MESSAGE: 'Сообщения',
  CHAT: 'Чаты',
  POST: 'Посты',
  COMMENT: 'Комментарии',
  MEDIA: 'Медиа',
};
export function TypeDistribution({
  items,
}: {
  items: Array<{ type: ReportTargetType; count: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (!items.length || total === 0)
    return <p className="data-note">Жалоб пока нет.</p>;
  return (
    <div className="bar-list">
      {items.map((item) => {
        const percentage = (item.count / total) * 100;
        return (
          <Link
            className="distribution-row"
            key={item.type}
            to={`/admin/reports?targetType=${item.type}`}
            title="Открыть все жалобы этого типа за всё время"
            aria-label={`${targetLabels[item.type] ?? item.type}: ${number(item.count)} жалоб, ${percentage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`}
          >
            <span>{targetLabels[item.type] ?? item.type}</span>
            <div aria-hidden="true">
              <i style={{ width: `${percentage}%` }} />
            </div>
            <strong>
              {number(item.count)}{' '}
              <small>
                {percentage.toLocaleString('ru-RU', {
                  maximumFractionDigits: 1,
                })}
                %
              </small>
            </strong>
          </Link>
        );
      })}
    </div>
  );
}
const statuses = {
  HEALTHY: { label: 'Работает', tone: 'success' },
  DEGRADED: { label: 'Сбои', tone: 'warning' },
  DOWN: { label: 'Недоступен', tone: 'danger' },
  UNKNOWN: { label: 'Нет данных', tone: 'neutral' },
};
export function SystemBadge({
  name,
  value,
}: {
  name: string;
  value: DashboardStatusItem;
}) {
  const status = statuses[value.status] ?? statuses.UNKNOWN;
  return (
    <div className="system-badge">
      <span>
        {name}
        <small>
          {value.latencyMs === undefined || !Number.isFinite(value.latencyMs)
            ? 'Задержка не измерена'
            : `${number(value.latencyMs)} мс`}
        </small>
      </span>
      <span className={`status status-${status.tone}`}>
        <i />
        {status.label}
      </span>
    </div>
  );
}
