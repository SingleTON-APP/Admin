import type { StaffRole } from '../types/domain';

export interface NavigationItem {
  path: string;
  title: string;
  description: string;
  group: string;
  icon:
    | 'overview'
    | 'shield'
    | 'users'
    | 'lock'
    | 'system'
    | 'file'
    | 'activity'
    | 'bell'
    | 'inbox'
    | 'help';
  roles?: StaffRole[];
}

const managers: StaffRole[] = ['ADMIN', 'FULL_ADMIN'];

export const navigation: NavigationItem[] = [
  {
    path: '/admin',
    title: 'Обзор',
    description: 'Главные показатели и задачи',
    group: 'Главное',
    icon: 'overview',
  },
  {
    path: '/admin/reports?view=mine',
    title: 'Моя очередь',
    description: 'Назначенные вам жалобы',
    group: 'Главное',
    icon: 'inbox',
  },
  {
    path: '/admin/reports',
    title: 'Все жалобы',
    description: 'Общая очередь модерации',
    group: 'Главное',
    icon: 'shield',
  },
  {
    path: '/admin/users',
    title: 'Пользователи',
    description: 'Поиск и управление аккаунтами',
    group: 'Главное',
    icon: 'users',
  },
  {
    path: '/admin/monitor',
    title: 'Мониторинг',
    description: 'Текущие метрики и сервисы',
    group: 'Наблюдение',
    icon: 'activity',
  },
  {
    path: '/admin/operations',
    title: 'Операции',
    description: 'Рабочие процессы и диагностика',
    group: 'Наблюдение',
    icon: 'system',
  },
  {
    path: '/admin/history',
    title: 'История метрик',
    description: 'Изменения показателей во времени',
    group: 'Наблюдение',
    icon: 'activity',
  },
  {
    path: '/admin/call-quality',
    title: 'Качество звонков',
    description: 'Стабильность и качество соединений',
    group: 'Наблюдение',
    icon: 'activity',
  },
  {
    path: '/admin/thresholds',
    title: 'Пороги уведомлений',
    description: 'Условия системных оповещений',
    group: 'Наблюдение',
    icon: 'bell',
  },
  {
    path: '/admin/notifications',
    title: 'Уведомления',
    description: 'Системные события и оповещения',
    group: 'Наблюдение',
    icon: 'bell',
  },
  {
    path: '/admin/report-groups',
    title: 'Группы жалоб',
    description: 'Связанные обращения и массовые случаи',
    group: 'Модерация',
    icon: 'shield',
  },
  {
    path: '/admin/appeals',
    title: 'Апелляции',
    description: 'Пересмотр решений модерации',
    group: 'Модерация',
    icon: 'shield',
    roles: managers,
  },
  {
    path: '/admin/site/news',
    title: 'Новости сайта',
    description: 'Публикации для главного сайта',
    group: 'Контент',
    icon: 'file',
    roles: managers,
  },
  {
    path: '/admin/staff',
    title: 'Сотрудники',
    description: 'Доступы и роли команды',
    group: 'Администрирование',
    icon: 'users',
    roles: ['FULL_ADMIN'],
  },
  {
    path: '/admin/security',
    title: 'Безопасность',
    description: 'Защита административного доступа',
    group: 'Администрирование',
    icon: 'lock',
    roles: ['FULL_ADMIN'],
  },
  {
    path: '/admin/audit',
    title: 'Журнал действий',
    description: 'История операций сотрудников',
    group: 'Администрирование',
    icon: 'lock',
    roles: managers,
  },
  {
    path: '/admin/system',
    title: 'Система',
    description: 'Системные параметры',
    group: 'Администрирование',
    icon: 'system',
    roles: managers,
  },
  {
    path: '/admin/access',
    title: 'Мои сессии и 2FA',
    description: 'Активные устройства и защита входа',
    group: 'Доступ',
    icon: 'lock',
  },
  {
    path: '/admin/help',
    title: 'Справка',
    description: 'Инструкции по работе с панелью',
    group: 'Помощь',
    icon: 'help',
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
