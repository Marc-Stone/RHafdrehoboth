import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { canAccessRole, ROUTE_ROLES } from '@/lib/permissions';
import UserAvatar from '@/components/feature/UserAvatar';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Menu principal',
    items: [{ label: 'Tableau de bord', path: '/', icon: 'ri-dashboard-3-line' }],
  },
  {
    title: 'Gestion',
    items: [
      { label: 'Membres', path: '/members', icon: 'ri-user-star-line' },
      { label: 'Communautés', path: '/communities', icon: 'ri-group-line' },
      { label: 'Événements', path: '/events', icon: 'ri-calendar-event-line' },
      { label: 'Scanner QR', path: '/scanner', icon: 'ri-qr-scan-2-line' },
    ],
  },
  {
    title: 'Suivi',
    items: [
      { label: 'Présences', path: '/attendances', icon: 'ri-check-double-line' },
      { label: 'Rapports', path: '/reports', icon: 'ri-file-chart-2-line' },
    ],
  },
  {
    title: 'Système',
    items: [
      { label: 'Notifications', path: '/notifications', icon: 'ri-notification-3-line' },
      { label: 'Historique', path: '/activity', icon: 'ri-history-line' },
      { label: 'Utilisateurs', path: '/users', icon: 'ri-shield-user-line' },
      { label: 'Paramètres', path: '/settings', icon: 'ri-settings-4-line' },
    ],
  },
];

// Menu minimal réservé à l'agent de présence : pointage uniquement.
const agentNav: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: 'ri-dashboard-3-line' },
  { label: 'Scanner QR', path: '/scanner', icon: 'ri-qr-scan-2-line' },
  { label: 'Mon compte', path: '/account', icon: 'ri-user-settings-line' },
];

// Espace de travail dédié au responsable de communauté, limité à sa communauté.
const leaderNav: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: 'ri-dashboard-3-line' },
  { label: 'Mes membres', path: '/members', icon: 'ri-user-star-line' },
  { label: 'Présences', path: '/attendances', icon: 'ri-check-double-line' },
  { label: 'Notifications', path: '/notifications', icon: 'ri-notification-3-line' },
  { label: 'WhatsApp', path: '/whatsapp', icon: 'ri-whatsapp-line' },
  { label: 'Mon compte', path: '/account', icon: 'ri-user-settings-line' },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const { settings, logoUrl: logo } = useSettings();
  const navigate = useNavigate();

  // La Sidebar ne se rend que lorsque l'utilisateur est authentifié et que son
  // rôle (validé dans useAuth) est connu. Aucun rôle par défaut codé en dur.
  if (!user) return null;

  const currentRole = user.role;
  const isAgent = currentRole === 'attendance_agent';
  const isLeader = currentRole === 'community_leader';

  const handleLogout = () => {
    onClose();
    void signOut();
    navigate('/login');
  };

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      onClick={onClose}
      className={({ isActive }) =>
        `group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-800'
            : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-500 transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          ></span>
          <span
            className={`flex h-6 w-6 items-center justify-center transition-colors ${
              isActive ? 'text-primary-600' : 'text-foreground-400 group-hover:text-foreground-600'
            }`}
          >
            <i className={`${item.icon} text-lg`}></i>
          </span>
          <span className="whitespace-nowrap">{item.label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-background-200/80 bg-background-50 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-background-200/70 px-5">
          {logo ? (
            <img
              src={logo}
              alt="Logo de l'église"
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-background-200"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-background-50">
              <i className="ri-home-line text-lg"></i>
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate font-heading text-sm font-bold text-foreground-950">
              {settings.churchName || 'Mon Église'}
            </p>
            <p className="truncate text-[11px] text-foreground-500">Gestion des présences</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {isAgent ? (
            <div className="space-y-0.5">{agentNav.map(renderNavItem)}</div>
          ) : isLeader ? (
            <div className="space-y-0.5">{leaderNav.map(renderNavItem)}</div>
          ) : (
            navGroups.map((group) => {
              const visibleItems = group.items.filter((item) =>
                canAccessRole(currentRole, ROUTE_ROLES[item.path] ?? [])
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.title} className="mb-5 last:mb-0">
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground-400">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">{visibleItems.map(renderNavItem)}</div>
                </div>
              );
            })
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-background-200/70 p-3">
          <div className="flex items-center gap-3 rounded-lg border border-background-200/80 bg-background-100/50 px-2.5 py-2.5">
            <UserAvatar initials={user?.initials ?? '?'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground-900">{user?.name ?? 'Utilisateur'}</p>
              <p className="truncate text-[11px] text-foreground-500">{user?.roleLabel ?? ''}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-background-50 hover:text-foreground-800"
              title="Se déconnecter"
            >
              <i className="ri-logout-box-r-line text-lg"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}