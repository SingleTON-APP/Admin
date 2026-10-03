import type { AuditEvent } from '../../types/domain';
import {
  auditActionLabel,
  auditContextLabel,
  auditResultClass,
  auditResultLabel,
} from '../../types/audit-labels';

export function AuditResult({ result }: { result: string }) {
  return (
    <span
      className={`status status-${auditResultClass(result)}`}
      title={result}
    >
      <i />
      {auditResultLabel(result)}
    </span>
  );
}

export function AuditEventDetails({ event }: { event: AuditEvent }) {
  const level =
    event.action === 'REPORT_CONTENT_VIEWED' &&
    typeof event.metadata.level === 'string'
      ? auditContextLabel(event.metadata.level)
      : undefined;
  return (
    <div className="audit-event-details">
      <strong title={event.action}>{auditActionLabel(event.action)}</strong>
      <small>
        <span>{event.staff?.name || 'Система'}</span> ·{' '}
        <time dateTime={event.timestamp}>
          {new Date(event.timestamp).toLocaleString('ru-RU')}
        </time>
      </small>
      <AuditResult result={event.result} />
      {level && <small>Доступ: {level}</small>}
      {event.reason && <p>{event.reason}</p>}
    </div>
  );
}
