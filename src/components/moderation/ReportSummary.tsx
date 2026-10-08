import { Link } from 'react-router-dom';
import type { Report } from '../../types/domain';
import {
  reportPriorityLabel,
  reportStatusLabel,
  reportTargetLabel,
  reportCategoryLabel,
} from '../../types/report-labels';
import { IDDisplay, StatusBadge } from '../ui/Primitives';

export function ReportSummary({ report }: { report: Report }) {
  const category = report.category?.toLowerCase();
  const label =
    category === 'fraud'
      ? 'Мошенничество'
      : category === 'illegal'
        ? 'Запрещённое содержимое'
        : reportCategoryLabel(category);
  return (
    <section
      className="card report-summary"
      aria-labelledby="report-description-heading"
    >
      <div className="card-head">
        <div>
          <span className="section-label">
            {reportTargetLabel[report.targetType]} · {label}
          </span>
          <h2 id="report-description-heading">
            {report.targetType === 'SUPPORT'
              ? 'Описание обращения'
              : 'Причина жалобы'}
          </h2>
        </div>
        <StatusBadge value={reportStatusLabel[report.status]} />
      </div>
      <p className="report-reason">{report.reason || 'Описание не указано.'}</p>
      <div className="report-summary-meta">
        <span>
          Заявитель:{' '}
          {report.reporter ? (
            <Link
              to={`/admin/users/${encodeURIComponent(report.reporter.publicId)}`}
            >
              {report.reporter.username
                ? `@${report.reporter.username}`
                : [report.reporter.firstName, report.reporter.lastName]
                    .filter(Boolean)
                    .join(' ') ||
                  report.reporter.publicId ||
                  'Пользователь'}
            </Link>
          ) : (
            'пользователь удалён'
          )}
        </span>
        <span>
          Создана:{' '}
          <time dateTime={report.createdAt}>
            {new Date(report.createdAt).toLocaleString('ru-RU')}
          </time>
        </span>
        <span>Исполнитель: {report.assignee?.name || 'Не назначен'}</span>
        <StatusBadge value={reportPriorityLabel[report.priority]} />
      </div>
      {report.resolutionReason && (
        <p className="report-resolution">
          <strong>Решение:</strong> {report.resolutionReason}
        </p>
      )}
      <details className="report-technical-details">
        <summary>Служебные сведения и идентификаторы</summary>
        <dl className="details-list compact">
          <div>
            <dt>ID жалобы</dt>
            <dd>
              <IDDisplay value={report.id} />
            </dd>
          </div>
          <div>
            <dt>ID объекта</dt>
            <dd>
              <IDDisplay value={report.targetId} />
            </dd>
          </div>
          {report.chatId && (
            <div>
              <dt>ID переписки</dt>
              <dd>
                <IDDisplay value={report.chatId} />
              </dd>
            </div>
          )}
          {report.sourceContextId && (
            <div>
              <dt>ID источника</dt>
              <dd>
                <IDDisplay value={report.sourceContextId} />
              </dd>
            </div>
          )}
          <div>
            <dt>Связанные жалобы</dt>
            <dd>{report.relatedReportsCount ?? 0}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
