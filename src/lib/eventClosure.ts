import { supabase } from '@/lib/supabase';
import { emitRefresh } from '@/lib/refreshBus';

export interface CloseResult {
  error: string | null;
  markedAbsent: number;
}

/**
 * Clôture un événement via la fonction serveur `close-events`.
 *
 * La clôture se faisait auparavant dans le navigateur, avec les droits de la
 * personne connectée : la liste des absents dépendait de ce qu'elle voyait,
 * était tronquée à 1000 lignes, et certaines erreurs laissaient l'événement
 * verrouillé sans ses absents. Le serveur fait désormais tout le traitement,
 * de façon idempotente (une seconde clôture ne fait rien).
 */
export async function closeEventInDb(eventId: string): Promise<CloseResult> {
  try {
    const { data, error } = await supabase.functions.invoke('close-events', {
      body: { action: 'close', eventId },
    });
    const payload = (data ?? {}) as { error?: string; markedAbsent?: number };
    if (error || payload.error) {
      let message = payload.error ?? null;
      // En cas d'erreur HTTP, le message métier est dans le corps de la réponse.
      const ctx = (error as { context?: Response } | null)?.context;
      if (!message && ctx && typeof ctx.json === 'function') {
        try {
          message = ((await ctx.json()) as { error?: string }).error ?? null;
        } catch {
          // corps illisible
        }
      }
      return { error: message ?? error?.message ?? 'La clôture a échoué.', markedAbsent: 0 };
    }
    emitRefresh();
    return { error: null, markedAbsent: payload.markedAbsent ?? 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'La clôture a échoué.', markedAbsent: 0 };
  }
}

/** Demande au serveur de clôturer tous les événements dont l'heure de fin est passée. */
export async function sweepDueEvents(): Promise<number> {
  try {
    const { data, error } = await supabase.functions.invoke('close-events', {
      body: { action: 'sweep' },
    });
    if (error) return 0;
    const closed = (data as { closed?: number } | null)?.closed ?? 0;
    if (closed > 0) emitRefresh();
    return closed;
  } catch {
    return 0;
  }
}
