import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import {
  operationsV3Service,
  type Dossier,
} from '../services/operations-v3.service';
import { PageHeader } from '../components/ui/Primitives';
import { auditActionLabel, auditTargetLabel } from '../types/audit-labels';
import { reportStatusLabel } from '../types/report-labels';
import '../styles/operations-v2.css';
import '../styles/operations-v3.css';

const sections: Record<Dossier['section'], string> = {
  reports: 'Связанные жалобы',
  sanctions: 'Санкции',
  decisions: 'Решения',
  appeals: 'Апелляции',
  audit: 'Действия',
};
export function UserDossierPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const rawSection = params.get('section') || 'reports';
  const section: Dossier['section'] =
    rawSection in sections ? (rawSection as Dossier['section']) : 'reports';
  const requested = Number(params.get('page'));
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const state = useAsync(
    (signal) => operationsV3Service.dossier(id, section, page, signal),
    [id, section, page],
  );
  return (
    <div className="operations-workspace">
      <PageHeader
        eyebrow="Модерация"
        title={
          state.data
            ? `Досье · ${state.data.user.name}`
            : 'Единое досье пользователя'
        }
        description="Связанные жалобы, санкции, решения, апелляции и административные действия. Без токенов, паролей и содержимого личных сессий."
        actions={
          <Link className="button secondary" to={`/admin/users/${id}`}>
            К аккаунту
          </Link>
        }
      />
      <nav className="operations-tabs" aria-label="Разделы досье">
        {Object.entries(sections).map(([key, label]) => (
          <Link
            key={key}
            to={`?section=${key}`}
            aria-current={section === key ? 'page' : undefined}
          >
            {label}
            {state.data
              ? ` (${state.data.counts[key as Dossier['section']]})`
              : ''}
          </Link>
        ))}
      </nav>
      {state.error && <p role="alert">{state.error}</p>}
      {state.loading && <p>Загрузка досье…</p>}
      {state.data && (
        <section className="card operation-card">
          <h2>{sections[section]}</h2>
          {section === 'reports' && (
            <p className="data-note">
              Связь объединяет жалобы пользователя и жалобы на него;
              историческая привязка субъекта не доказывает нарушение.
            </p>
          )}
          {state.data.items.length ? (
            <ol className="operation-timeline">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <header>
                    <strong>
                      {item.action
                        ? auditActionLabel(item.action)
                        : item.type ||
                          (item.status &&
                            reportStatusLabel[
                              item.status as keyof typeof reportStatusLabel
                            ]) ||
                          item.status ||
                          'Запись'}
                    </strong>
                    <small>
                      {' '}
                      · {new Date(item.createdAt).toLocaleString('ru-RU')}
                    </small>
                  </header>
                  {item.status && (
                    <p>
                      Состояние:{' '}
                      {reportStatusLabel[
                        item.status as keyof typeof reportStatusLabel
                      ] || item.status}
                    </p>
                  )}
                  {item.relation && (
                    <p>
                      {item.relation === 'SUBMITTED'
                        ? 'Подана пользователем'
                        : 'Связана с пользователем как субъектом'}
                    </p>
                  )}
                  {item.targetType && (
                    <p>
                      {auditTargetLabel(item.targetType)}
                      {item.targetId && ` · ${item.targetId}`}
                    </p>
                  )}
                  <p className="operation-reason">
                    {item.reason || 'Основание не указано'}
                  </p>
                  {item.publicReason && (
                    <p>
                      <strong>Публичное объяснение:</strong> {item.publicReason}
                    </p>
                  )}
                  {item.resolutionReason && (
                    <p>
                      <strong>Решение:</strong> {item.resolutionReason}
                    </p>
                  )}
                  {item.reviewReason && (
                    <p>
                      <strong>Результат пересмотра:</strong> {item.reviewReason}
                    </p>
                  )}
                  {item.dueAt && (
                    <p>
                      Срок обработки:{' '}
                      {new Date(item.dueAt).toLocaleString('ru-RU')}
                    </p>
                  )}
                  {item.expiresAt && (
                    <p>
                      Истекает:{' '}
                      {new Date(item.expiresAt).toLocaleString('ru-RU')}
                    </p>
                  )}
                  {item.result && <p>Результат: {item.result}</p>}
                  {section === 'reports' && (
                    <Link
                      to={`/admin/reports/${item.id}`}
                      state={{ from: `/admin/users/${id}/dossier?${params}` }}
                    >
                      Открыть жалобу
                    </Link>
                  )}
                  {section === 'appeals' && (
                    <Link to={`/admin/appeals/${item.id}`}>
                      Открыть апелляцию
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>Записей в этом разделе нет.</p>
          )}
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setParams({ section, page: String(page - 1) })}
            >
              Назад по досье
            </button>
            <span>
              Страница {page} · всего {state.data.total}
            </span>
            <button
              disabled={page * state.data.limit >= state.data.total}
              onClick={() => setParams({ section, page: String(page + 1) })}
            >
              Далее по досье
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
