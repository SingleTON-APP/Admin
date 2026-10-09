import { AdminAccessBoundary } from '../features/admin-access/AdminAccessBoundary';
import { SecurityPage } from '../pages/SecurityPage';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AuditPage } from '../pages/AuditPage';
import { DashboardPage } from '../pages/DashboardPage';
import { MonitorPage } from '../pages/MonitorPage';
import { ReportDetailsPage } from '../pages/ReportDetailsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { StaffPage } from '../pages/StaffPage';
import { SystemPage } from '../pages/SystemPage';
import { UserDetailsPage } from '../pages/UserDetailsPage';
import { UsersPage } from '../pages/UsersPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { HelpPage } from '../pages/HelpPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  {
    element: (
      <AdminAccessBoundary>
        <AppShell />
      </AdminAccessBoundary>
    ),
    children: [
      { path: '/admin', element: <DashboardPage /> },
      { path: '/admin/monitor', element: <MonitorPage /> },
      { path: '/admin/notifications', element: <NotificationsPage /> },
      { path: '/admin/help', element: <HelpPage /> },
      {
        path: '/admin/history',
        lazy: async () => ({
          Component: (await import('../pages/HistoryPage')).HistoryPage,
        }),
      },
      {
        path: '/admin/call-quality',
        lazy: async () => ({
          Component: (await import('../pages/CallQualityPage')).CallQualityPage,
        }),
      },
      {
        path: '/admin/thresholds',
        lazy: async () => ({
          Component: (await import('../pages/ThresholdsPage')).ThresholdsPage,
        }),
      },
      {
        path: '/admin/access',
        lazy: async () => ({
          Component: (await import('../pages/AccessSecurityPage'))
            .AccessSecurityPage,
        }),
      },
      {
        path: '/admin/report-groups',
        lazy: async () => ({
          Component: (await import('../pages/ReportGroupsPage'))
            .ReportGroupsPage,
        }),
      },
      {
        path: '/admin/report-groups/:id',
        lazy: async () => ({
          Component: (await import('../pages/ReportGroupsPage'))
            .ReportGroupDetailsPage,
        }),
      },
      {
        path: '/admin/appeals',
        lazy: async () => ({
          Component: (await import('../pages/AppealsPage')).AppealsPage,
        }),
      },
      {
        path: '/admin/appeals/:id',
        lazy: async () => ({
          Component: (await import('../pages/AppealsPage')).AppealDetailsPage,
        }),
      },
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/users/:id', element: <UserDetailsPage /> },
      { path: '/admin/reports', element: <ReportsPage /> },
      { path: '/admin/reports/:id', element: <ReportDetailsPage /> },
      { path: '/admin/staff', element: <StaffPage /> },
      { path: '/admin/security', element: <SecurityPage /> },
      { path: '/admin/audit', element: <AuditPage /> },
      { path: '/admin/system', element: <SystemPage /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]);
