import { useMemo, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationType } from '@/lib/types';
import PageHeader from '@/components/base/PageHeader';

const typeMeta: Record<NotificationType, { icon: string; label: string; color: string }> = {
  rappel: { icon: 'ri-alarm-line', label: 'Rappel', color: 'bg-primary-100 text-primary-700' },
  confirmation: { icon: 'ri-checkbox-circle-line', label: 'Confirmation', color: 'bg-accent-100 text-accent-700' },
  alerte: { icon: 'ri-alert-line', label: 'Alerte', color: 'bg-secondary-100 text-secondary-700' },
  info: { icon: 'ri-information-line', label: 'Information', color: 'bg-background-100 text-foreground-600' },
};

type Filter = 'all' | 'unread' | 'read';

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'unread', label: 'Non lues' },
  { value: 'read', label: 'Lues' },
];

export default function NotificationsPage() {
  const { notifications, loading, error, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    if (filter === 'read') return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Suivi"
        icon="ri-notification-3-line"
        title="Notifications"
        description="Rappels, confirmations et alertes de l'église."
        meta={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              unreadCount > 0
                ? 'bg-accent-100 text-accent-800'
                : 'bg-background-100 text-foreground-600'
            }`}
          >
            <i className="ri-mail-unread-line text-sm"></i>
            {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
          </span>
        }
        actions={
          <button
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-check-double-line"></i>
            Tout marquer comme lu
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 p-12 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Chargement des notifications...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-background-200 bg-background-50 p-12 text-center">
          <p className="text-sm text-foreground-600">{error}</p>
          <button
            onClick={fetchNotifications}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Réessayer
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
            <i className="ri-notification-3-line text-3xl"></i>
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucune notification</h2>
          <p className="mt-2 max-w-sm text-sm text-foreground-500">
            Vous n'avez aucune notification pour le moment.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-1 rounded-full border border-background-200 bg-background-50 p-1">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    filter === opt.value
                      ? 'bg-primary-500 text-background-50'
                      : 'text-foreground-600 hover:bg-background-100'
                  }`}
                >
                  {opt.label}
                  {opt.value === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-background-50/25 px-1.5 text-xs">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
            <span className="text-xs text-foreground-400">{unreadCount} notification(s) non lue(s)</span>
          </div>

          <div className="space-y-3">
            {filtered.map((n) => {
              const meta = typeMeta[n.type] ?? typeMeta.info;
              return (
                <button
                  key={n.id}
                  onClick={() => void markAsRead(n.id)}
                  className={`flex w-full cursor-pointer items-start gap-4 rounded-lg border p-4 text-left transition-colors ${
                    n.read
                      ? 'border-background-200 bg-background-50 hover:border-background-300'
                      : 'border-primary-200 bg-primary-50/50 hover:bg-primary-100/40'
                  }`}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                    <i className={`${meta.icon} text-xl`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-sm font-semibold text-foreground-900">{n.title}</h3>
                      <span className="rounded-full bg-background-100 px-2 py-0.5 text-[11px] font-medium text-foreground-500">
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground-600">{n.message}</p>
                    <p className="mt-1.5 text-xs text-foreground-400">{n.time}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-500"></span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-lg border border-background-200 bg-background-50 py-12 text-center text-foreground-400">
              Aucune notification dans cette catégorie.
            </div>
          )}
        </>
      )}
    </div>
  );
}