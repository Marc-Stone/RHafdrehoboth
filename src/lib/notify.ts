import { supabase } from '@/lib/supabase';

/**
 * Payload des notifications in-app. Chaque action est traitée par l'Edge
 * Function `notify`, qui détermine les destinataires (administrateurs +
 * responsable de la communauté concernée) et écrit dans la table `notifications`.
 */
type NotifyPayload =
  | {
      action: 'event-created' | 'event-updated';
      eventTitle: string;
      eventDate: string;
      communityId: string | null;
    }
  | {
      action: 'member-added' | 'member-suspended';
      memberName: string;
      communityId: string | null;
    }
  // La notification de clôture est envoyée par la fonction `close-events`.
  | { action: 'daily-reminders' };

export async function notify(payload: NotifyPayload): Promise<void> {
  try {
    await supabase.functions.invoke('notify', { body: payload });
  } catch {
    // Les notifications ne doivent jamais casser le flux principal.
  }
}