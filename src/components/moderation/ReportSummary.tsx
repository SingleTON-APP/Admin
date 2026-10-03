import { Link } from 'react-router-dom';
import type { Report } from '../../types/domain';
import {
  reportPriorityLabel,
  reportStatusLabel,
  reportTargetLabel,
} from '../../types/report-labels';
import { IDDisplay, StatusBadge } from '../ui/Primitives';

export function ReportSummary({ report }: { report: Report }) {
  const created = new Date(report.createdAt);
  const hours = Math.max(
    0,
    Math.floor((Date.now() - created.getTime()) / 3_600_000),
  );
  return (
    <section className="card report-summary">
      <div className="card-head">
        <h2>Жалоба</h2>
        <StatusBadge value={reportStatusLabel[report.status]} />
      </div>
      <dl className="details-list compact">
        <div>
          <dt>ID</dt>
          <dd>
            <IDDisplay value={report.id} />
          </dd>
        </div>
        <div>
          <dt>Цель</dt>
          <dd>{reportTargetLabel[report.targetType]}</dd>
        </div>
        <div>
          <dt>ID объекта</dt>
          <dd>
            <IDDisplay value={report.targetId} />
          </dd>
        </div>
        <div>
          <dt>Категория</dt>
          <dd>{report.category}</dd>
        </div>
        <div>
          <dt>Приоритет</dt>
          <dd>
            <StatusBadge value={reportPriorityLabel[report.priority]} />
          </dd>
        </div>
        <div>
          <dt>Возраст</dt>
          <dd className={hours >= 24 ? 'text-danger' : ''}>
            {hours < 24 ? `${hours} ч` : `${Math.floor(hours / 24)} д`}
          </dd>
        </div>
        <div>
          <dt>Исполнитель</dt>
          <dd>{report.assignee?.name || 'Не назначен'}</dd>
        </div>
        <div>
          <dt>Связанные</dt>
          <dd>{report.relatedReportsCount ?? 0}</dd>
        </div>
      </dl>
      <h3>Описание</h3>
      <p>{report.reason}</p>
      <hr />
      <h3>Заявитель</h3>
      {report.reporter ? (
        <Link
          className="user-card"
          to={`/admin/users/${report.reporter.publicId}`}
        >
          <span>
            <strong>@{report.reporter.username}</strong>
            <small>{report.reporter.publicId}</small>
          </span>
        </Link>
      ) : (
        <p className="data-note">Пользователь удалён</p>
      )}
    </section>
  );
}
