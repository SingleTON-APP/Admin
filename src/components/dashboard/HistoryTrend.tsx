export function HistoryTrend({
  label,
  unit,
  points,
}: {
  label: string;
  unit: string;
  points: Array<{ timestamp: string; value: number | null }>;
}) {
  const values = points.flatMap(({ value }) =>
    value != null && Number.isFinite(value) ? [value] : [],
  );
  if (!values.length)
    return <p className="data-note">{label}: нет измерений.</p>;
  const max = Math.max(1, ...values);
  const x = (index: number) =>
    50 + (index / Math.max(1, points.length - 1)) * 560;
  const y = (value: number) => 135 - (value / max) * 110;
  const segments: string[][] = [];
  let segment: string[] = [];
  points.forEach((point, index) => {
    if (point.value == null || !Number.isFinite(point.value)) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push(`${x(index)},${y(point.value)}`);
  });
  if (segment.length) segments.push(segment);
  return (
    <figure className="history-trend">
      <figcaption>
        {label} · {unit}
      </figcaption>
      <svg
        viewBox="0 0 630 168"
        role="img"
        aria-label={`${label}, ${unit}. Пропуски не соединяются; точные значения в таблице.`}
      >
        {[0, max / 2, max].map((value) => (
          <g key={value}>
            <line
              x1="50"
              x2="610"
              y1={y(value)}
              y2={y(value)}
              className="chart-axis"
            />
            <text x="44" y={y(value) + 4} textAnchor="end">
              {value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        {segments.map((part, index) =>
          part.length === 1 ? (
            <circle
              key={index}
              cx={part[0]!.split(',')[0]}
              cy={part[0]!.split(',')[1]}
              r="3"
              fill="currentColor"
            />
          ) : (
            <polyline
              key={index}
              points={part.join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          ),
        )}
        {[...new Set([0, points.length - 1])].map((index) => (
          <text
            key={index}
            x={x(index)}
            y="158"
            textAnchor={index === 0 ? 'start' : 'end'}
          >
            {new Date(points[index]!.timestamp).toLocaleString('ru-RU', {
              timeZone: 'UTC',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            UTC
          </text>
        ))}
      </svg>
    </figure>
  );
}
