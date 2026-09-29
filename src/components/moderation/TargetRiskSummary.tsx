import { Link } from 'react-router-dom';
import type { ReportDetails } from '../../types/domain';
import { Avatar } from '../ui/Primitives';

export function TargetRiskSummary({ report }: { report: ReportDetails }) {
  const user = report.targetUser;
  return <section className="card target-panel"><div className="card-head"><h2>Автор / субъект</h2></div>
    {user ? <><div className="target-profile"><Avatar name={`${user.firstName} ${user.lastName}`} size="lg" />
      <h2>@{user.username}</h2><span>{user.publicId}</span><small>{user.role}</small></div>
      <dl className="details-list compact"><div><dt>Прошлые жалобы</dt><dd>{report.targetRisk.priorReports}</dd></div>
      <div><dt>Санкции</dt><dd>{report.targetRisk.sanctions.length}</dd></div></dl>
      {!!report.targetRisk.sanctions.length && <div className="sanction-list"><h3>История санкций</h3>
        {report.targetRisk.sanctions.map((item) => <article key={item.id}><strong>{item.type}</strong>
          <small>{item.status} · {new Date(item.createdAt).toLocaleDateString('ru-RU')}</small><p>{item.reason}</p></article>)}</div>}
      <Link className="button secondary full-width" to={`/admin/users/${user.publicId}`}>Открыть профиль</Link></>
      : <p className="data-note">Автор или субъект не определён.</p>}
  </section>;
}
