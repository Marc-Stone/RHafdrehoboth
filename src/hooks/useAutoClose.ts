import { useEffect, useRef } from 'react';
import { sweepDueEvents } from '@/lib/eventClosure';
import { useAuth } from '@/hooks/useAuth';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

/**
 * Déclenche la clôture automatique des événements terminés.
 *
 * Le traitement est fait par la fonction serveur `close-events` (avec les
 * droits du serveur, indépendamment du rôle de la personne connectée). Il est
 * recommandé de le planifier aussi côté serveur (cron) : voir la migration
 * `supabase/migrations/20261114000000_audit_fixes.sql`. Ce hook n'est qu'un
 * déclencheur d'appoint lorsque l'application est ouverte.
 */
export function useAutoClose() {
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    const runSweep = async () => {
      if (runningRef.current) return;
      if (Date.now() - lastRunRef.current < MIN_GAP_MS) return;
      runningRef.current = true;
      lastRunRef.current = Date.now();
      try {
        await sweepDueEvents();
      } finally {
        runningRef.current = false;
      }
    };

    void runSweep();
    const interval = setInterval(runSweep, SWEEP_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void runSweep();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);
}
