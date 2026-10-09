import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { AdminContext } from '../../features/admin-access/AdminContext';
import { LogoutContext } from '../../features/admin-access/LogoutContext';

vi.mock('./SidebarHealth', () => ({
  SidebarHealth: () => <div>Сервисы всегда видны</div>,
}));
vi.mock('../notifications/Notifications', () => ({
  NotificationsProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  NotificationBell: () => null,
}));

describe('compact sidebar groups', () => {
  it('shows only the active group, switches groups and keeps services visible', () => {
    render(
      <AdminContext.Provider
        value={{
          id: 'root',
          publicId: 'root',
          name: 'Root',
          email: '',
          role: 'FULL_ADMIN',
        }}
      >
        <LogoutContext.Provider value={vi.fn()}>
          <MemoryRouter initialEntries={['/admin/history']}>
            <AppShell />
          </MemoryRouter>
        </LogoutContext.Provider>
      </AdminContext.Provider>,
    );
    const nav = within(
      screen.getByRole('navigation', { name: 'Основная навигация' }),
    );
    expect(
      nav
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Рабочее пространство',
      'Мониторинг',
      'Модерация',
      'Пользователи',
      'Контент',
      'Управление',
      'Доступ',
      'Помощь',
    ]);
    fireEvent.click(nav.getByRole('button', { name: 'Контент' }));
    expect(nav.getByRole('link', { name: 'Новости сайта' })).toBeVisible();
    fireEvent.click(nav.getByRole('button', { name: 'Мониторинг' }));
    expect(nav.getByRole('button', { name: 'Мониторинг' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(nav.queryByRole('link', { name: 'Обзор' })).not.toBeInTheDocument();
    fireEvent.click(nav.getByRole('button', { name: 'Модерация' }));
    expect(nav.getByRole('button', { name: 'Мониторинг' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(nav.getByRole('link', { name: 'Группы жалоб' })).toBeVisible();
    expect(
      nav.queryByRole('link', { name: 'История метрик' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Сервисы всегда видны')).toBeVisible();
    fireEvent.click(nav.getByRole('link', { name: 'Группы жалоб' }));
    expect(nav.getByRole('button', { name: 'Модерация' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
