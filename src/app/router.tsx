import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AuditPage } from '../pages/AuditPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ReportDetailsPage } from '../pages/ReportDetailsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { StaffPage } from '../pages/StaffPage';
import { SystemPage } from '../pages/SystemPage';
import { UserDetailsPage } from '../pages/UserDetailsPage';
import { UsersPage } from '../pages/UsersPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  {
    element: <AppShell />,
    children: [
      { path: '/admin', element: <DashboardPage /> },
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/users/:id', element: <UserDetailsPage /> },
      { path: '/admin/reports', element: <ReportsPage /> },
      { path: '/admin/reports/:id', element: <ReportDetailsPage /> },
      { path: '/admin/staff', element: <StaffPage /> },
      { path: '/admin/audit', element: <AuditPage /> },
      { path: '/admin/system', element: <SystemPage /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]);
