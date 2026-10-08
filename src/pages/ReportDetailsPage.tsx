import { AuditEventDetails } from '../components/audit/AuditEventDetails';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ActionPanel } from '../components/moderation/ActionPanel';
import { ModerationContextViewer } from '../components/moderation/ModerationContextViewer';
import { ReportSummary } from '../components/moderation/ReportSummary';
import { SupportReplyPanel } from '../components/moderation/SupportReplyPanel';
import { TargetRiskSummary } from '../components/moderation/TargetRiskSummary';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import { adminService } from '../services/admin.service';
import { reportPriorityLabel, reportTargetLabel } from '../types/report-labels';

export function ReportDetailsPage() {
  const admin = useAdmin();
  const { id = '' } = useParams();
  const location = useLocation();
  const returnTo =
    (location.state as { from?: string } | null)?.from ?? '/admin/reports';
  const [reload, setReload] = useState(0);
  const state = useAsync(
    (signal) => adminService.report(id, signal),
    [id, reload],
  );
  const staffState = useAsync(
    (signal) =>
      admin.role === 'MODERATOR'
        ? Promise.resolve([])
        : adminService.staff(signal),
    [admin.role, reload],
  );
  if (state.loading)
    return (
      <>
        <Link className="button secondary" to={returnTo}>
          К очереди
        </Link>
        <LoadingState />
      </>
    );
  if (state.error || !state.data)
    return (
      <>
        <Link className="button secondary" to={returnTo}>
          К очереди
        </Link>
        <ErrorState message={state.error ?? 'Жалоба не найдена'} />
        <button
          className="button secondary"
          onClick={() => setReload((value) => value + 1)}
        >
          Повторить загрузку
        </button>
      </>
    );
  const report = state.data;
  return (
    <>
      <PageHeader
        eyebrow="Рабочее место модератора"
        title={`${report.targetType === 'SUPPORT' ? 'Обращение' : 'Жалоба'} ${report.id.slice(0, 8)}`}
        description={`${reportTargetLabel[report.targetType]} · создана ${new Date(report.createdAt).toLocaleString('ru-RU')}`}
        actions={
          <>
            <StatusBadge value={reportPriorityLabel[report.priority]} />
            <Link className="button secondary" to={returnTo}>
              К очереди
            </Link>
          </>
        }
      />
      <div className="moderation-workbench">
        <div className="workbench-left">
          <ReportSummary report={report} />
          {report.targetType === 'SUPPORT' && (
            <SupportReplyPanel
              report={report}
              onSent={() => setReload((value) => value + 1)}
            />
          )}
          <section className="card report-history">
            <div className="card-head">
              <h2>История обработки</h2>
            </div>
            {report.history.length ? (
              <div className="timeline">
                {report.history.map((event) => (
                  <div key={event.id}>
                    <i />
                    <AuditEventDetails event={event} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="data-note">Действий пока нет.</p>
            )}
            {!!report.notes.length && (
              <>
                <h3>Внутренние комментарии</h3>
                <div className="notes-list">
                  {report.notes.map((note) => (
                    <article key={note.id}>
                      <header>
                        <strong>{note.author?.name || 'Система'}</strong>
                        <time dateTime={note.createdAt}>
                          {new Date(note.createdAt).toLocaleString('ru-RU')}
                        </time>
                      </header>
                      <p>{note.body}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
        <ModerationContextViewer
          key={report.id}
          reportId={report.id}
          role={admin.role}
        />
        <aside className="workbench-right">
          <TargetRiskSummary report={report} />
          {staffState.error && (
            <p className="state-error" role="alert">
              Не удалось загрузить список исполнителей.{' '}
              <button
                className="button ghost"
                onClick={() => setReload((value) => value + 1)}
              >
                Повторить
              </button>
            </p>
          )}
          <ActionPanel
            report={report}
            admin={admin}
            staff={staffState.data ?? []}
            onChanged={() => setReload((value) => value + 1)}
          />
        </aside>
      </div>
    </>
  );
}
