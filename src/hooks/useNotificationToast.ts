import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { NotificationType } from '@/lib/types';

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

const AUTO_DISMISS_MS = 6000;
const MAX_TOASTS = 4;

/**
 * Écoute en temps réel les notifications nouvellement créées pour l'utilisateur
 * connecté, et les expose sous forme de toasts auto-fermants. Complémentaire du
 * hook `useNotifications` (qui, lui, gère la liste complète et le badge).
 */
export function useNotificationToast() {
  const { user } = useAuth();
  const userId = user?.id;
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const timersRef = useRef<number[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notification-toasts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            type: string | null;
            title: string | null;
            message: string | null;
          };
          // Filet de sécurité : on ne montre que les notifications qui nous
          // concernent réellement, même si le filtre temps réel change.
          if (row.user_id !== userId) return;

          const toast: ToastNotification = {
            id: row.id,
            type: (row.type as NotificationType) ?? 'info',
            title: row.title ?? 'Notification',
            message: row.message ?? '',
          };
          setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), toast]);
          const timer = window.setTimeout(() => {
            dismiss(toast.id);
          }, AUTO_DISMISS_MS);
          timersRef.current.push(timer);
        },
      )
      .subscribe();

    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      void supabase.removeChannel(channel);
    };
  }, [userId, dismiss]);

  return { toasts, dismiss };
}