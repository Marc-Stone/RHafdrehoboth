import { useNavigate } from 'react-router-dom';
import { useNotificationToast, type ToastNotification } from '@/hooks/useNotificationToast';
import type { NotificationType } from '@/lib/types';

const typeMeta: Record<NotificationType, { icon: string; color: string }> = {
  rappel: { icon: 'ri-alarm-line', color: 'bg-primary-100 text-primary-700' },
  confirmation: { icon: 'ri-checkbox-circle-line', color: 'bg-accent-100 text-accent-700' },
  alerte: { icon: 'ri-alert-line', color: 'bg-secondary-100 text-secondary-700' },
  info: { icon: 'ri-information-line', color: 'bg-background-100 text-foreground-600' },
};

function ToastCard({
  toast,
  onDismiss,
  onOpen,
}: {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onOpen: () => void;
}) {
  const meta = typeMeta[toast.type] ?? typeMeta.info;

  return (
    <div
      onClick={onOpen}
      className="animate-slide-in-right pointer-events-auto flex w-80 cursor-pointer items-start gap-3 rounded-lg border border-background-300 bg-background-50 p-4"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
        <i className={`${meta.icon} text-lg`}></i>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-heading text-sm font-semibold text-foreground-900">{toast.title}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-background-100 hover:text-foreground-700"
            aria-label="Fermer"
          >
            <i className="ri-close-line text-base"></i>
          </button>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-foreground-600">{toast.message}</p>
      </div>
    </div>
  );
}

export default function NotificationToastHost() {
  const { toasts, dismiss } = useNotificationToast();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex flex-col gap-3 md:right-6">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={dismiss}
          onOpen={() => navigate('/notifications')}
        />
      ))}
    </div>
  );
}