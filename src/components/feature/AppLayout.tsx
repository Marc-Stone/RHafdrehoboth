import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NotificationToastHost from './NotificationToastHost';
import ErrorBoundary from './ErrorBoundary';
import { useAutoClose } from '@/hooks/useAutoClose';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useAutoClose();

  return (
    <div className="flex h-screen overflow-hidden bg-background-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden lg:pl-[264px]">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="relative flex-1 overflow-y-auto bg-gradient-to-b from-background-50 via-background-50 to-background-100/40">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            {/* Une erreur dans une page ne fait plus tomber toute
                l'application : le menu reste utilisable, et changer de page
                efface l'erreur. */}
            <ErrorBoundary variant="page" resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      {/* Les notifications flottantes sont isolées : un souci d'affichage
          d'une notification ne doit jamais bloquer l'écran. */}
      <ErrorBoundary variant="silent" resetKey={location.pathname}>
        <NotificationToastHost />
      </ErrorBoundary>
    </div>
  );
}
