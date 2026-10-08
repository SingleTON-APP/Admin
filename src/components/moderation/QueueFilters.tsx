import { useState, type FormEvent } from 'react';
import {
  reportPriorityLabel,
  reportStatusLabel,
  reportTargetLabel,
} from '../../types/report-labels';
import type {
  ReportPriority,
  ReportQueueCounts,
  ReportStatus,
  ReportTargetType,
} from '../../types/domain';

const views = [
  ['new', 'Новые'],
  ['mine', 'Моя очередь'],
  ['critical', 'Критичные'],
  ['unassigned', 'Без исполнителя'],
] as const;

export function QueueFilters({
  params,
  counts,
  onChange,
}: {
  params: URLSearchParams;
  counts?: ReportQueueCounts;
  onChange: (changes: Record<string, string>) => void;
}) {
  const [searchReset, setSearchReset] = useState(0);
  const currentView =
    params.get('view') ??
    (params.get('assignee') === 'me'
      ? 'mine'
      : params.get('assignee') === 'unassigned'
        ? 'unassigned'
        : '');
  return (
    <>
      <nav className="queue-tabs" aria-label="Представления очереди">
        <button
          className={!currentView ? 'active' : ''}
          aria-pressed={!currentView}
          onClick={() => onChange({ view: '', assignee: '' })}
        >
          Все <strong>{counts?.all?.toLocaleString('ru-RU') ?? '—'}</strong>
        </button>
        {views.map(([key, label]) => (
          <button
            key={key}
            className={currentView === key ? 'active' : ''}
            aria-pressed={currentView === key}
            onClick={() =>
              onChange({ view: key, assignee: '', status: '', priority: '' })
            }
          >
            {label}
            <strong>{counts?.[key]?.toLocaleString('ru-RU') ?? '—'}</strong>
          </button>
        ))}
      </nav>
      <div className="queue-filters">
        <QueueSearch
          key={`${params.get('search') ?? ''}:${searchReset}`}
          initialSearch={params.get('search') ?? ''}
          onChange={onChange}
        />
        <label>
          Объект
          <select
            aria-label="Тип объекта"
            value={params.get('targetType') ?? ''}
            onChange={(event) => onChange({ targetType: event.target.value })}
          >
            <option value="">Все</option>
            {(
              [
                'USER',
                'MESSAGE',
                'CHAT',
                'POST',
                'COMMENT',
                'MEDIA',
                'SUPPORT',
              ] satisfies ReportTargetType[]
            ).map((value) => (
              <option key={value} value={value}>
                {reportTargetLabel[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Статус
          <select
            aria-label="Статус"
            value={params.get('status') ?? ''}
            onChange={(event) => onChange({ status: event.target.value })}
          >
            <option value="">Все</option>
            {(
              [
                'OPEN',
                'IN_REVIEW',
                'RESOLVED',
                'REJECTED',
              ] satisfies ReportStatus[]
            ).map((value) => (
              <option key={value} value={value}>
                {reportStatusLabel[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Приоритет
          <select
            aria-label="Приоритет"
            value={params.get('priority') ?? ''}
            onChange={(event) => onChange({ priority: event.target.value })}
          >
            <option value="">Все</option>
            {(
              ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] satisfies ReportPriority[]
            ).map((value) => (
              <option key={value} value={value}>
                {reportPriorityLabel[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Исполнитель
          <select
            aria-label="Исполнитель"
            value={params.get('assignee') ?? ''}
            onChange={(event) =>
              onChange({ assignee: event.target.value, view: '' })
            }
          >
            <option value="">Все</option>
            <option value="me">Я</option>
            <option value="unassigned">Не назначен</option>
          </select>
        </label>
        <label>
          Возраст
          <select
            aria-label="Возраст жалобы"
            value={params.get('age') ?? ''}
            onChange={(event) => onChange({ age: event.target.value })}
          >
            <option value="">Любой</option>
            <option value="1">Старше часа</option>
            <option value="6">Старше 6 часов</option>
            <option value="24">Старше суток</option>
          </select>
        </label>
        <label>
          Сортировка
          <select
            aria-label="Сортировка"
            value={params.get('sort') ?? 'priority'}
            onChange={(event) => onChange({ sort: event.target.value })}
          >
            <option value="priority">Приоритет</option>
            <option value="age">Возраст</option>
            <option value="updatedAt">Обновление</option>
          </select>
        </label>
        <label>
          Направление
          <select
            aria-label="Направление сортировки"
            value={params.get('order') ?? 'desc'}
            onChange={(event) => onChange({ order: event.target.value })}
          >
            <option value="desc">По убыванию</option>
            <option value="asc">По возрастанию</option>
          </select>
        </label>
        <button
          className="button ghost"
          onClick={() => {
            setSearchReset((value) => value + 1);
            onChange({
              view: '',
              search: '',
              targetType: '',
              status: '',
              priority: '',
              assignee: '',
              age: '',
              sort: '',
              order: '',
            });
          }}
        >
          Сбросить
        </button>
      </div>
    </>
  );
}

function QueueSearch({
  initialSearch,
  onChange,
}: {
  initialSearch: string;
  onChange: (changes: Record<string, string>) => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onChange({ search: search.trim() });
  };
  return (
    <form className="queue-search" onSubmit={submit}>
      <label className="sr-only" htmlFor="report-search">
        Поиск жалоб
      </label>
      <input
        id="report-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ID жалобы, объекта, пользователя или username"
      />
      <button className="button secondary" type="submit">
        Найти
      </button>
    </form>
  );
}
