import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../features/admin-access/AdminContext';
import {
  globalSearch,
  type SearchGroup,
} from '../../services/global-search.service';
import { Dialog } from '../ui/Dialog';
import '../../styles/global-search.css';

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { role } = useAdmin();
  const [input, setInput] = useState('');
  const [retry, setRetry] = useState(0);
  const query = input.trim();
  const [result, setResult] = useState<{
    query: string;
    groups: SearchGroup[];
  } | null>(null);
  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void globalSearch(query, role, controller.signal)
        .then((groups) => {
          if (!controller.signal.aborted) setResult({ query, groups });
        })
        .catch(() => {
          /* A closed or superseded search is ignored. */
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, role, retry]);
  const groups = result?.query === query ? result.groups : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (groups)
      document
        .querySelector<HTMLAnchorElement>('.global-search-results a')
        ?.click();
  }
  return (
    <Dialog open title="Поиск по админке" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Ник, email, ID, название новости или код ошибки
          <input
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <div className="global-search-results" aria-live="polite">
          {query.length < 2 ? (
            <p className="muted">
              Введите хотя бы 2 символа. Поиск учитывает ваши права доступа.
            </p>
          ) : !groups ? (
            <p role="status">Ищем…</p>
          ) : (
            <>
              {groups.map((group) => (
                <section key={group.label}>
                  <h3>{group.label}</h3>
                  {group.error ? (
                    <p role="alert">{group.error}</p>
                  ) : group.items.length ? (
                    group.items.map((item) => (
                      <Link key={item.path} to={item.path} onClick={onClose}>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="muted">Совпадений нет</p>
                  )}
                </section>
              ))}
              {groups.some((group) => group.error) && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Повторить поиск
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </Dialog>
  );
}
