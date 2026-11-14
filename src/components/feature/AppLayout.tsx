import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NotificationToastHost from './NotificationToastHost';
import { useAutoClose } from '@/hooks/useAutoClose';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAutoClose();

  return (
    <div className="flex h-screen overflow-hidden bg-background-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden lg:pl-[264px]">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="relative flex-1 overflow-y-auto bg-gradient-to-b from-background-50 via-background-50 to-background-100/40">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <NotificationToastHost />
    </div>
  );
}