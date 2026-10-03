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
    path: '/admin',
    title: 'Обзор',
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
