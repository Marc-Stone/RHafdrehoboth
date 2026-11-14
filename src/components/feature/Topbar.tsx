import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/feature/UserAvatar';
import { useNotifications } from '@/hooks/useNotifications';

const sectionLabels: { prefix: string; label: string }[] = [
  { prefix: '/members', label: 'Membres' },
  { prefix: '/communities', label: 'Communautés' },
  { prefix: '/events', label: 'Événements' },
  { prefix: '/scanner', label: 'Scanner QR' },
  { prefix: '/attendances', label: 'Présences' },
  { prefix: '/reports', label: 'Rapports' },
  { prefix: '/notifications', label: 'Notifications' },
  { prefix: '/activity', label: 'Historique' },
  { prefix: '/users', label: 'Utilisateurs' },
  { prefix: '/settings', label: 'Paramètres' },
  { prefix: '/whatsapp', label: 'WhatsApp' },
  { prefix: '/account', label: 'Mon compte' },
];

function sectionForPath(pathname: string): string {
  const match = sectionLabels.find((entry) => pathname.startsWith(entry.prefix));
  return match?.label ?? 'Tableau de bord';
}

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const dark = theme === 'dark';
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAgent = user?.role === 'attendance_agent';
  const section = sectionForPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-background-200/70 bg-background-50/80 px-4 backdrop-blur-xl md:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-600 transition-colors hover:bg-background-100 lg:hidden"
        title="Ouvrir le menu"
      >
        <i className="ri-menu-line text-xl"></i>
      </button>

      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-400">
          Espace de gestion
        </span>
        <span className="flex h-4 w-4 items-center justify-center text-foreground-300">
          <i className="ri-arrow-right-s-line"></i>
        </span>
        <span className="truncate text-sm font-semibold text-foreground-800">{section}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-600 transition-colors hover:bg-background-100"
          title={dark ? 'Mode clair' : 'Mode sombre'}
        >
          <i className={`${dark ? 'ri-sun-line' : 'ri-moon-line'} text-lg`}></i>
        </button>
        {!isAgent && (
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-600 transition-colors hover:bg-background-100"
            title="Notifications"
          >
            <i className="ri-notification-3-line text-lg"></i>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-none text-background-50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-background-200 sm:block"></span>
        <div className="flex items-center gap-2.5">
          <UserAvatar initials={user?.initials ?? '?'} />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold text-foreground-900">{user?.name ?? 'Utilisateur'}</p>
            <p className="text-[11px] text-foreground-500">{user?.roleLabel ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}