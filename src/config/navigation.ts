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
    path: '/admin/reports?status=IN_REVIEW',
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
    roles: managers,
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
