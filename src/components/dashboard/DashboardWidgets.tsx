import type {
  DashboardStatusItem,
  DashboardTrendPoint,
  ReportTargetType,
} from '../../types/domain';
import { StatusBadge } from '../ui/Primitives';

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
  const height = 180;
  const values = points.flatMap((point) => [point.count, point.secondary ?? 0]);
  const max = Math.max(1, ...values);
  const line = (key: 'count' | 'secondary') =>
    points
      .map((point, index) => {
        const x =
          points.length === 1
            ? width / 2
            : (index / (points.length - 1)) * width;
        const value = key === 'count' ? point.count : (point.secondary ?? 0);
        return `${x},${height - 18 - (value / max) * (height - 36)}`;
      })
      .join(' ');
  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <title>{label}</title>
        <line
          x1="0"
          y1={height - 18}
          x2={width}
          y2={height - 18}
          className="chart-axis"
        />
        <polyline
          points={line('count')}
          className="chart-line chart-line-primary"
        />
        {secondaryLabel && (
          <polyline
            points={line('secondary')}
            className="chart-line chart-line-secondary"
          />
        )}
      </svg>
      <div className="chart-labels">
        <span>{new Date(points[0]!.date).toLocaleDateString('ru-RU')}</span>
        <span>{new Date(points.at(-1)!.date).toLocaleDateString('ru-RU')}</span>
      </div>
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
  if (!items.length) return <p className="data-note">Жалоб пока нет.</p>;
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div key={item.type}>
          <span>{targetLabels[item.type] ?? item.type}</span>
          <div>
            <i style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <strong>{item.count.toLocaleString('ru-RU')}</strong>
        </div>
      ))}
    </div>
  );
}

export function SystemBadge({
  name,
  value,
}: {
  name: string;
  value: DashboardStatusItem;
}) {
  return (
    <div className="system-badge">
      <span>
        {name}
        <small>
          {value.latencyMs === undefined
            ? 'Состояние сервиса'
            : `${value.latencyMs} мс`}
        </small>
      </span>
      <StatusBadge value={value.status} />
    </div>
  );
}
