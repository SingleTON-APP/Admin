import { AuditEventDetails } from '../components/audit/AuditEventDetails';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { queueQuery } from '../components/moderation/queue-query';
import { ActionPanel } from '../components/moderation/ActionPanel';
import { ReportDeadline } from '../components/moderation/ReportDeadline';
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
import type { ReportDetails } from '../types/domain';
import '../styles/report-workbench.css';

export function ReportDetailsPage() {
  const admin = useAdmin();
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from;
  const returnTo =
    typeof from === 'string' && /^\/admin\/reports(?:\?|$)/.test(from)
      ? from
      : '/admin/reports';
  const [nextFailure, setNextFailure] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const nextError = nextFailure?.id === id ? nextFailure.text : '';
  const [nextBusy, setNextBusy] = useState(false);
  const nextRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      nextRequest.current?.abort();
      nextRequest.current = null;
    };
  }, [id]);
  async function openNext() {
    nextRequest.current?.abort();
    const request = new AbortController();
    nextRequest.current = request;
    setNextBusy(true);
    setNextFailure(null);
    const query = queueQuery(new URLSearchParams(returnTo.split('?')[1] || ''));
    try {
      const result = await adminService.reports({
        ...query,
        page: 1,
        pageSize: 1,
        activeOnly: true,
        excludeId: id,
        signal: request.signal,
        status:
          query.status === 'OPEN' || query.status === 'IN_REVIEW'
            ? query.status
            : undefined,
      });
      if (request.signal.aborted) return;
      const next = result.items[0];
      navigate(
        next ? `/admin/reports/${encodeURIComponent(next.id)}` : returnTo,
        {
          state: next
            ? { from: returnTo }
            : {
                notice:
                  'Решение сохранено. Открытых жалоб по этим фильтрам больше нет.',
              },
        },
      );
    } catch {
      if (request.signal.aborted) return;
      setNextFailure({
        id,
        text: 'Решение сохранено. Следующую жалобу загрузить не удалось — вернитесь к очереди или повторите переход.',
      });
      setReload((value) => value + 1);
    } finally {
      if (nextRequest.current === request) {
        nextRequest.current = null;
        setNextBusy(false);
      }
    }
  }
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
            <a className="button secondary" href="#report-actions">
              К действиям
            </a>
            <Link className="button secondary" to={returnTo}>
              К очереди
            </Link>
          </>
        }
      />
      {nextError && (
        <p className="action-result error" role="alert">
          {nextError}{' '}
          <button
            className="button secondary"
            disabled={nextBusy}
            onClick={() => void openNext()}
          >
            {nextBusy ? 'Переходим…' : 'Повторить переход'}
          </button>
        </p>
      )}
      <div className="report-workspace">
        <ReportSummary report={report} />
        <div className="report-workspace-main">
          <ModerationContextViewer
            key={`context-${report.id}`}
            reportId={report.id}
            role={admin.role}
            targetType={report.targetType}
          />
          {report.targetType === 'SUPPORT' && (
            <SupportReplyPanel
              report={report}
              onSent={() => setReload((value) => value + 1)}
            />
          )}
          <ReportActivity key={`activity-${report.id}`} report={report} />
        </div>
        <aside
          className="report-workspace-actions"
          id="report-actions"
          tabIndex={-1}
          aria-label="Действия по жалобе"
        >
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
            key={report.id}
            report={report}
            admin={admin}
            staff={staffState.data ?? []}
            onChanged={() => setReload((value) => value + 1)}
            onResolved={openNext}
          />
          <ReportDeadline
            report={report}
            onChanged={() => setReload((value) => value + 1)}
          />
        </aside>
      </div>
    </>
  );
}

function ReportActivity({ report }: { report: ReportDetails }) {
  const [tab, setTab] = useState<'history' | 'notes' | 'risk'>('history');
  const tabs = [
    { id: 'history', label: 'История обработки' },
    { id: 'notes', label: `Заметки (${report.notes.length})` },
    { id: 'risk', label: 'Автор и нарушения' },
  ] as const;
  return (
    <section className="card report-activity">
      <div
        className="report-activity-tabs"
        role="tablist"
        aria-label="История и сведения по жалобе"
      >
        {tabs.map(({ id, label }, index) => (
          <button
            key={id}
            type="button"
            id={`report-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls="report-activity-panel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              const target = tabs[next]!;
              setTab(target.id);
              document.getElementById(`report-tab-${target.id}`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="report-activity-panel"
        aria-labelledby={`report-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'history' &&
          (report.history.length ? (
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
          ))}
        {tab === 'notes' &&
          (report.notes.length ? (
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
          ) : (
            <p className="data-note">
              Внутренних заметок пока нет. Добавить заметку можно в панели
              действий.
            </p>
          ))}
        {tab === 'risk' && <TargetRiskSummary report={report} />}
      </div>
    </section>
  );
}
