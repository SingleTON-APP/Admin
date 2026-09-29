import { Link } from 'react-router-dom';
import type { Report } from '../../types/domain';
import { Avatar, StatusBadge } from '../ui/Primitives';

export function TargetRiskSummary({ report }: { report: Report }) {
  const user = report.targetUser;
  return <section className="card target-panel"><div className="card-head"><h2>Автор / субъект</h2></div>
    {user ? <><div className="target-profile"><Avatar name={`${user.firstName} ${user.lastName}`} size="lg" />
      <h2>@{user.username}</h2><span>{user.publicId}</span><StatusBadge value={user.status} /></div>
      <dl className="details-list compact"><div><dt>Прошлые жалобы</dt><dd>{user.reportCount}</dd></div>
      <div><dt>Роль</dt><dd>{user.role}</dd></div><div><dt>Регистрация</dt>
      <dd>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</dd></div></dl>
      <Link className="button secondary full-width" to={`/admin/users/${user.publicId}`}>Открыть профиль</Link></>
      : <p className="data-note">Автор или субъект не определён.</p>}
  </section>;
}
