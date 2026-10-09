import type { StaffRole } from '../types/domain';

export interface NavigationItem {
  path: string;
  title: string;
  group: string;
  icon: 'overview' | 'shield' | 'users' | 'lock' | 'system';
  roles?: StaffRole[];
}

const managers: StaffRole[] = ['ADMIN', 'FULL_ADMIN'];

export const navigation: NavigationItem[] = [
  {
    path: '/admin/history',
    title: 'История метрик',
    group: 'Мониторинг',
    icon: 'system',
  },
  {
    path: '/admin/call-quality',
    title: 'Качество звонков',
    group: 'Мониторинг',
    icon: 'system',
  },
  {
    path: '/admin/thresholds',
    title: 'Пороги уведомлений',
    group: 'Мониторинг',
    icon: 'system',
  },
  {
    path: '/admin/report-groups',
    title: 'Группы жалоб',
    group: 'Модерация',
    icon: 'shield',
  },
  {
    path: '/admin/appeals',
    title: 'Апелляции',
    group: 'Модерация',
    icon: 'shield',
    roles: managers,
  },
  {
    path: '/admin/access',
    title: 'Мои сессии и 2FA',
    group: 'Доступ',
    icon: 'lock',
  },
  {
    path: '/admin/monitor',
    title: 'Мониторинг',
    group: 'Рабочее пространство',
    icon: 'system',
  },
  {
    path: '/admin',
    title: 'Обзор',
    group: 'Рабочее пространство',
    icon: 'overview',
  },
  {
    path: '/admin/notifications',
    title: 'Уведомления',
    group: 'Рабочее пространство',
    icon: 'overview',
  },
  {
    path: '/admin/reports',
    title: 'Жалобы',
    group: 'Модерация',
    icon: 'shield',
  },
  {
    path: '/admin/reports?view=mine',
    title: 'Моя очередь',
    group: 'Модерация',
    icon: 'shield',
  },
  {
    path: '/admin/users',
    title: 'Пользователи',
    group: 'Пользователи',
    icon: 'users',
  },
  {
    path: '/admin/staff',
    title: 'Сотрудники',
    group: 'Управление',
    icon: 'users',
    roles: ['FULL_ADMIN'],
  },
  {
    path: '/admin/security',
    title: 'Безопасность',
    group: 'Управление',
    icon: 'lock',
    roles: ['FULL_ADMIN'],
  },
  {
    path: '/admin/audit',
    title: 'Журнал действий',
    group: 'Управление',
    icon: 'lock',
    roles: managers,
  },
  {
    path: '/admin/system',
    title: 'Система',
    group: 'Управление',
    icon: 'system',
    roles: managers,
  },
  { path: '/admin/help', title: 'Справка', group: 'Помощь', icon: 'overview' },
];

export function isNavigationActive(
  path: string,
  pathname: string,
  search: string,
) {
  const params = new URLSearchParams(search);
  const mine =
    params.get('view') === 'mine' ||
    (!params.get('view') && params.get('assignee') === 'me');
  if (path.includes('?view=mine')) return pathname === '/admin/reports' && mine;
  if (path === '/admin/reports' && pathname === '/admin/reports') return !mine;
  return path === '/admin'
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
}
