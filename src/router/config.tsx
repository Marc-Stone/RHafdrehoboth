import { lazyWithRetry } from '../lib/chunkRecovery';
import type { RouteObject } from 'react-router-dom';
import RequireAuth from '../components/feature/RequireAuth';
import RequireRole from '../components/feature/RequireRole';
import PageSuspense from '../components/feature/PageSuspense';
import { ROUTE_ROLES } from '../lib/permissions';

/**
 * Chaque page est chargée à la demande (code splitting).
 * L'application démarre donc avec un bundle minimal ; les écrans lourds
 * (graphiques, rapports, formulaires) ne sont téléchargés qu'au premier accès.
 *
 * ⚠️ `element` reçoit toujours un élément JSX (jamais l'appel `lazy()`), et le
 * composant est enveloppé dans un `<Suspense>` avec un fallback stable.
 */
const NotFound = lazyWithRetry(() => import('../pages/NotFound'));
const LoginPage = lazyWithRetry(() => import('../pages/auth/page'));
const ForbiddenPage = lazyWithRetry(() => import('../pages/Forbidden'));
const DashboardPage = lazyWithRetry(() => import('../pages/dashboard/page'));
const MembersPage = lazyWithRetry(() => import('../pages/members/page'));
const MemberDetailPage = lazyWithRetry(() => import('../pages/members/detail/page'));
const ScannerPage = lazyWithRetry(() => import('../pages/scanner/page'));
const CommunitiesPage = lazyWithRetry(() => import('../pages/communities/page'));
const EventsPage = lazyWithRetry(() => import('../pages/events/page'));
const AttendancesPage = lazyWithRetry(() => import('../pages/attendances/page'));
const ReportsPage = lazyWithRetry(() => import('../pages/reports/page'));
const NotificationsPage = lazyWithRetry(() => import('../pages/notifications/page'));
const ActivityPage = lazyWithRetry(() => import('../pages/activity/page'));
const SettingsPage = lazyWithRetry(() => import('../pages/settings/page'));
const UsersPage = lazyWithRetry(() => import('../pages/users/page'));
const AccountPage = lazyWithRetry(() => import('../pages/account/page'));
const WhatsAppPage = lazyWithRetry(() => import('../pages/whatsapp/page'));

const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <PageSuspense>
        <LoginPage />
      </PageSuspense>
    ),
  },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        index: true,
        element: (
          <PageSuspense>
            <DashboardPage />
          </PageSuspense>
        ),
      },
      {
        path: 'members',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/members']}>
            <PageSuspense>
              <MembersPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'members/:number',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/members']}>
            <PageSuspense>
              <MemberDetailPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'communities',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/communities']}>
            <PageSuspense>
              <CommunitiesPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'events',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/events']}>
            <PageSuspense>
              <EventsPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'scanner',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/scanner']}>
            <PageSuspense>
              <ScannerPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'attendances',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/attendances']}>
            <PageSuspense>
              <AttendancesPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/reports']}>
            <PageSuspense>
              <ReportsPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'notifications',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/notifications']}>
            <PageSuspense>
              <NotificationsPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'activity',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/activity']}>
            <PageSuspense>
              <ActivityPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/settings']}>
            <PageSuspense>
              <SettingsPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/users']}>
            <PageSuspense>
              <UsersPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'whatsapp',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/whatsapp']}>
            <PageSuspense>
              <WhatsAppPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: 'account',
        element: (
          <RequireRole allowed={ROUTE_ROLES['/account']}>
            <PageSuspense>
              <AccountPage />
            </PageSuspense>
          </RequireRole>
        ),
      },
      {
        path: '403',
        element: (
          <PageSuspense>
            <ForbiddenPage />
          </PageSuspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <PageSuspense>
        <NotFound />
      </PageSuspense>
    ),
  },
];

export default routes;