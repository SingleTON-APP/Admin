import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { appConfig } from '../../config/app';
import { isNavigationActive, navigation } from '../../config/navigation';
import { useAdmin } from '../../features/admin-access/AdminContext';
import { useAdminLogout } from '../../features/admin-access/LogoutContext';
import { Avatar } from '../ui/Primitives';
import { Icon } from '../ui/Icon';
import { SidebarHealth } from './SidebarHealth';
import { GlobalSearch } from './GlobalSearch';
import {
  NotificationBell,
  NotificationsProvider,
} from '../notifications/Notifications';
import '../../styles/monitor.css';
import '../../styles/sidebar-navigation.css';

export function AppShell() {
  const admin = useAdmin();
  return (
    <NotificationsProvider key={`${admin.id}:${admin.role}`}>
      <ShellContent />
    </NotificationsProvider>
  );
}

function ShellContent() {
  const admin = useAdmin();
  const logout = useAdminLogout();
  const [compact, setCompact] = useState(
    () => localStorage.getItem('admin-sidebar-compact') === 'true',
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileNavigationOpen(false);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const allowedNavigation = useMemo(
    () =>
      navigation.filter(
        (item) => !item.roles || item.roles.includes(admin.role),
      ),
    [admin.role],
  );
  const groupOrder = [
    'Главное',
    'Наблюдение',
    'Модерация',
    'Контент',
    'Администрирование',
    'Доступ',
    'Помощь',
  ];
  const groups = [...new Set(allowedNavigation.map((item) => item.group))].sort(
    (left, right) => groupOrder.indexOf(left) - groupOrder.indexOf(right),
  );
  const currentNavigation = allowedNavigation.find((item) =>
    isNavigationActive(item.path, location.pathname, location.search),
  );
  const activeGroup = currentNavigation?.group || groups[0];
  const [expanded, setExpanded] = useState<{
    route: string;
    group: string | null;
  } | null>(null);
  const expandedGroup =
    expanded?.route === location.pathname ? expanded.group : activeGroup;

  function toggleCompact() {
    setCompact((value) => {
      localStorage.setItem('admin-sidebar-compact', String(!value));
      return !value;
    });
  }

  return (
    <div
      className={`app-shell ${compact ? 'is-compact' : ''} ${mobileNavigationOpen ? 'has-mobile-navigation' : ''}`}
    >
      <a className="skip-link" href="#content">
        К содержимому
      </a>
      <aside className="sidebar" id="main-navigation">
        <div className="brand">
          <Link
            className="brand-home"
            to="/admin"
            aria-label="На главную"
            onClick={() => setMobileNavigationOpen(false)}
          >
            <span className="brand-mark">H</span>
            <span className="brand-text">
              {appConfig.name}
              <small>Центр управления</small>
            </span>
          </Link>
          <button
            className="collapse-button"
            onClick={toggleCompact}
            aria-label={compact ? 'Развернуть меню' : 'Свернуть меню'}
            title={compact ? 'Развернуть меню' : 'Свернуть меню'}
          >
            <Icon name="panel" size={16} />
          </button>
        </div>
        <nav aria-label="Основная навигация">
          {groups.map((group) => (
            <section key={group} className="nav-group">
              <button
                className="nav-group-toggle"
                type="button"
                aria-label={group}
                aria-expanded={expandedGroup === group}
                onClick={() =>
                  setExpanded({
                    route: location.pathname,
                    group: expandedGroup === group ? null : group,
                  })
                }
                title={compact ? group : undefined}
              >
                <span>{group}</span>
                <i aria-hidden="true">{expandedGroup === group ? '⌄' : '›'}</i>
              </button>
              <div hidden={expandedGroup !== group}>
                {allowedNavigation
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileNavigationOpen(false)}
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
                      aria-label={item.title}
                      title={compact ? item.title : item.description}
                    >
                      <Icon name={item.icon} />
                      <span className="nav-item-copy">
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </nav>
        <SidebarHealth />
        <div className="sidebar-account">
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
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Выйти из аккаунта"
            title="Выйти"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="Закрыть меню"
        onClick={() => setMobileNavigationOpen(false)}
      />
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu-button icon-button"
            type="button"
            onClick={() => setMobileNavigationOpen(true)}
            aria-label="Открыть меню"
            aria-controls="main-navigation"
            aria-expanded={mobileNavigationOpen}
          >
            <Icon name="menu" />
          </button>
          <div className="page-context">
            <span>{currentNavigation?.group ?? 'Hub Admin'}</span>
            <strong>{currentNavigation?.title ?? 'Панель управления'}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
              aria-label="Поиск по админке"
            >
              <Icon name="search" />
              <span>Поиск по админке</span>
              <kbd>Ctrl K</kbd>
            </button>
            <NotificationBell />
          </div>
        </header>
        <main id="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
