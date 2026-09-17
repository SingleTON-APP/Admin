import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Avatar({
  name,
  initials,
  size = 'md',
}: {
  name: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={`avatar avatar-${size}`} title={name}>
      {initials ??
        name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)}
    </span>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = ['active', 'healthy', 'success', 'resolved', 'online'].includes(
    value.toLowerCase(),
  )
    ? 'success'
    : ['banned', 'down', 'critical', 'failed', 'deleted'].includes(
          value.toLowerCase(),
        )
      ? 'danger'
      : ['degraded', 'suspended', 'high', 'in review'].includes(
            value.toLowerCase(),
          )
        ? 'warning'
        : 'neutral';
  return (
    <span className={`status status-${tone}`}>
      <i />
      {value}
    </span>
  );
}

export function IDDisplay({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const short =
    value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
  return (
    <button
      className="id-display"
      title={value}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      <code>{copied ? 'Скопировано' : short}</code>
      <Icon name="copy" size={13} />
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone = 'default',
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: string;
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
    </article>
  );
}

export function LoadingState() {
  return (
    <div className="state">
      <span className="spinner" />
      Загрузка данных…
    </div>
  );
}
export function EmptyState({
  title = 'Ничего не найдено',
}: {
  title?: string;
}) {
  return (
    <div className="state">
      {title}
      <small>Измените фильтры или поисковый запрос.</small>
    </div>
  );
}
export function ErrorState({ message }: { message: string }) {
  return <div className="state state-error">Ошибка: {message}</div>;
}

export function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const spread = max - min || 1;
  const points = data
    .map(
      (value, i) =>
        `${(i / (data.length - 1)) * 100},${35 - ((value - min) / spread) * 30}`,
    )
    .join(' ');
  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}
