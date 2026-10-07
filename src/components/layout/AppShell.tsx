import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { appConfig } from '../../config/app';
import { isNavigationActive, navigation } from '../../config/navigation';
import { useAdmin } from '../../features/admin-access/AdminContext';
import { useAdminLogout } from '../../features/admin-access/LogoutContext';
import { Avatar } from '../ui/Primitives';
import { Icon } from '../ui/Icon';
import { SidebarHealth } from './SidebarHealth';
import '../../styles/monitor.css';

const routeLabels: Record<string, string> = {
  admin: 'Админка',
  reports: 'Жалобы',
  users: 'Пользователи',
  staff: 'Сотрудники',
  audit: 'Аудит',
  system: 'Система',
  security: 'Безопасность',
  monitor: 'Мониторинг',
};

export function AppShell() {
  const admin = useAdmin();
  const logout = useAdminLogout();
  const [compact, setCompact] = useState(
    () => localStorage.getItem('admin-sidebar-compact') === 'true',
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const allowedNavigation = useMemo(
    () =>
      navigation.filter(
        (item) => !item.roles || item.roles.includes(admin.role),
      ),
    [admin.role],
  );
  const groups = [...new Set(allowedNavigation.map((item) => item.group))];
  const crumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => routeLabels[part] ?? part);

  function toggleCompact() {
    setCompact((value) => {
      localStorage.setItem('admin-sidebar-compact', String(!value));
      return !value;
    });
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/admin/users?search=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  }

  return (
    <>
      <div className={`app-shell ${compact ? 'is-compact' : ''}`}>
        <a className="skip-link" href="#content">
          К содержимому
        </a>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">H</span>
            <span className="brand-text">
              {appConfig.name}
              <small>Operations</small>
            </span>
            <button
              className="collapse-button"
              onClick={toggleCompact}
              aria-label={compact ? 'Развернуть меню' : 'Свернуть меню'}
            >
              ‹
            </button>
          </div>
          <nav aria-label="Основная навигация">
            {groups.map((group) => (
              <section key={group} className="nav-group">
                <h2>{group}</h2>
                {allowedNavigation
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={
                        isNavigationActive(
                          item.path,
                          location.pathname,
                          location.search,
                        )
                          ? 'active'
                          : undefined
                      }
                      aria-current={
                        isNavigationActive(
                          item.path,
                          location.pathname,
                          location.search,
                        )
                          ? 'page'
                          : undefined
                      }
                      title={compact ? item.title : undefined}
                    >
                      <Icon name={item.icon} />
                      <span>{item.title}</span>
                    </Link>
                  ))}
              </section>
            ))}
          </nav>
          <SidebarHealth />
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumbs">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`}>
                  {index > 0 && '/'} {crumb}
                </span>
              ))}
            </div>
            <div className="topbar-actions">
              <button
                className="global-search"
                onClick={() => setSearchOpen(true)}
              >
                <Icon name="search" />
                <span>Поиск пользователей</span>
                <kbd>Ctrl K</kbd>
              </button>
              <button
                className="button secondary"
                onClick={() => void logout()}
              >
                Выйти
              </button>
              <div className="account">
                <div className="account-identity">
                  <Avatar name={admin.name || admin.email} size="sm" />
                  <span>
                    <strong>{admin.name || admin.email}</strong>
                    <small>
                      {
                        {
                          MODERATOR: 'Модератор',
                          ADMIN: 'Администратор',
                          FULL_ADMIN: 'Полный администратор',
                        }[admin.role]
                      }
                    </small>
                  </span>
                </div>
              </div>
            </div>
          </header>
          <main id="content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
        {searchOpen && (
          <div
            className="search-overlay"
            onMouseDown={() => setSearchOpen(false)}
          >
            <form
              className="search-modal"
              onSubmit={submitSearch}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div>
                <Icon name="search" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Имя, username, email или ID"
                />
                <kbd>ESC</kbd>
              </div>
              <div className="search-modal-results">
                <p>
                  Нажмите Enter, чтобы открыть результаты поиска пользователей.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
