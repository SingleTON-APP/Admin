import { useState, type FormEvent } from 'react';
import type { ReportPriority, ReportQueueCounts, ReportStatus, ReportTargetType } from '../../types/domain';

const views = [
  ['new', 'Новые'], ['mine', 'Моя очередь'], ['critical', 'Критичные'], ['unassigned', 'Без исполнителя'],
] as const;

export function QueueFilters({
  params,
  counts,
  onChange,
}: {
  params: URLSearchParams;
  counts: ReportQueueCounts;
  onChange: (changes: Record<string, string>) => void;
}) {
  const [search, setSearch] = useState(params.get('search') ?? '');
  const submit = (event: FormEvent) => { event.preventDefault(); onChange({ search: search.trim() }); };
  return <>
    <nav className="queue-tabs" aria-label="Представления очереди">
      <button className={!params.get('view') ? 'active' : ''} onClick={() => onChange({ view: '' })}>
        Все <strong>{counts.all}</strong>
      </button>
      {views.map(([key, label]) => <button key={key} className={params.get('view') === key ? 'active' : ''}
        onClick={() => onChange({ view: key })}>{label}<strong>{counts[key]}</strong></button>)}
    </nav>
    <div className="queue-filters">
      <form className="queue-search" onSubmit={submit}>
        <label className="sr-only" htmlFor="report-search">Поиск жалоб</label>
        <input id="report-search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Report ID, target ID, user ID или username" />
        <button className="button secondary" type="submit">Найти</button>
      </form>
      <label>Объект<select aria-label="Тип объекта" value={params.get('targetType') ?? ''}
        onChange={(event) => onChange({ targetType: event.target.value })}>
        <option value="">Все</option>{(['USER','MESSAGE','CHAT','POST','COMMENT','MEDIA'] satisfies ReportTargetType[])
          .map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Статус<select aria-label="Статус" value={params.get('status') ?? ''}
        onChange={(event) => onChange({ status: event.target.value })}>
        <option value="">Все</option>{(['OPEN','IN_REVIEW','RESOLVED','REJECTED'] satisfies ReportStatus[])
          .map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Приоритет<select aria-label="Приоритет" value={params.get('priority') ?? ''}
        onChange={(event) => onChange({ priority: event.target.value })}>
        <option value="">Все</option>{(['LOW','MEDIUM','HIGH','CRITICAL'] satisfies ReportPriority[])
          .map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Исполнитель<select aria-label="Исполнитель" value={params.get('assignee') ?? ''}
        onChange={(event) => onChange({ assignee: event.target.value })}>
        <option value="">Все</option><option value="me">Я</option><option value="unassigned">Не назначен</option>
      </select></label>
      <label>Возраст<select aria-label="Возраст жалобы" value={params.get('age') ?? ''}
        onChange={(event) => onChange({ age: event.target.value })}>
        <option value="">Любой</option><option value="lt1h">До часа</option><option value="1to6h">1–6 часов</option>
        <option value="6to24h">6–24 часа</option><option value="gt24h">Более суток</option>
      </select></label>
      <label>Сортировка<select aria-label="Сортировка" value={params.get('sort') ?? 'priority'}
        onChange={(event) => onChange({ sort: event.target.value })}>
        <option value="priority">Приоритет</option><option value="age">Возраст</option><option value="updated">Обновление</option>
      </select></label>
      <button className="button ghost" onClick={() => { setSearch(''); onChange({
        view: '', search: '', targetType: '', status: '', priority: '', assignee: '', age: '', sort: '', order: '',
      }); }}>Сбросить</button>
    </div>
  </>;
}
