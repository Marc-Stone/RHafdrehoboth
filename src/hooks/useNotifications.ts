import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChurchNotification, NotificationType } from '@/lib/types';
import { notify } from '@/lib/notify';
import { getCurrentUserId } from '@/lib/currentUser';
import { safeGetItem, safeSetItem } from '@/lib/safeStorage';
import { wallClock } from '@/lib/serverClock';
import { readCache, writeCache, invalidateCache, dedupe } from '@/lib/dataCache';

/** Topbar et page Notifications lisent la même liste : le cache évite un
 * deuxième appel réseau à chaque navigation. */
const NOTIFICATIONS_CACHE_KEY = 'notifications:list';
const NOTIFICATIONS_CACHE_TTL = 15_000;

interface NotificationRow {
  id: string;
  type: string;
  title: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
}

function toNotification(row: NotificationRow): ChurchNotification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title ?? '',
    message: row.message ?? '',
    time: new Date(row.created_at).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    read: row.read,
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<ChurchNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    const cached = options?.force
      ? null
      : readCache<ChurchNotification[]>(NOTIFICATIONS_CACHE_KEY, NOTIFICATIONS_CACHE_TTL);
    if (cached) {
      setNotifications(cached);
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await dedupe(NOTIFICATIONS_CACHE_KEY, async () => {
        const { data, error: fErr } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });
        if (fErr) throw fErr;
        return (data as NotificationRow[]).map(toNotification);
      });
      writeCache(NOTIFICATIONS_CACHE_KEY, list);
      setNotifications(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(() => load(false, { force: true }), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Rappel « la veille » : génère les notifications des événements du lendemain,
  // une fois par jour maximum (évite d'appeler l'Edge Function à chaque rendu).
  useEffect(() => {
    // Date du jour à l'heure de l'église (et non en UTC) ; le serveur calcule
    // lui aussi « demain » dans le fuseau de l'église.
    const today = wallClock(Date.now()).date;
    const key = `notif-daily-${today}`;
    if (safeGetItem(key)) return;
    safeSetItem(key, '1');
    void notify({ action: 'daily-reminders' });
  }, []);

  // Mise à jour en temps réel : dès qu'une notification est créée ou lue,
  // on recharge la liste pour que le badge de la barre du haut reste à jour.
  // Le canal est strictement filtré sur l'utilisateur courant : on ne reçoit
  // jamais les notifications des autres comptes.
  useEffect(() => {
    let activeChannelActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      // Aucune exception ne doit s'échapper de cette tâche de fond : un
      // rafraîchissement de session échoué ne doit pas remonter comme erreur
      // non gérée (ni interrompre les notifications en temps réel).
      let uid: string | null = null;
      try {
        uid = await getCurrentUserId();
      } catch {
        uid = null;
      }
      if (!activeChannelActive || !uid) return;
      channel = supabase
        .channel(`notifications-realtime-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          () => {
            // Événement réel en base : on invalide le cache partagé avant de
            // relire, pour que le badge et la page restent synchronisés.
            invalidateCache(NOTIFICATIONS_CACHE_KEY);
            void fetchNotifications();
          },
        )
        .subscribe();
    })();

    return () => {
      activeChannelActive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      writeCache(NOTIFICATIONS_CACHE_KEY, next);
      return next;
    });
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      writeCache(NOTIFICATIONS_CACHE_KEY, next);
      return next;
    });
  };

  return { notifications, loading, error, unreadCount, fetchNotifications, markAsRead, markAllAsRead };
}