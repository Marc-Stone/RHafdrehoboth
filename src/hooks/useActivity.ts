import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { readCache, writeCache, dedupe } from '@/lib/dataCache';
import type { ActivityLog, ActivityAction } from '@/lib/types';

const ACTIVITY_CACHE_KEY = 'activity:logs';
const ACTIVITY_CACHE_TTL = 20_000;

interface ActivityRow {
  id: string;
  user_name: string | null;
  role_label: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

function toLog(row: ActivityRow): ActivityLog {
  const d = new Date(row.created_at);
  // Date locale (et non UTC) : sinon une action de fin de soirée en GMT+1
  // était classée la veille, alors que l'heure affichée restait locale.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    id: row.id,
    user: row.user_name ?? 'Utilisateur',
    role: row.role_label ?? 'Utilisateur',
    action: row.action as ActivityAction,
    details: row.details ?? '',
    date: `${y}-${m}-${day}`,
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function useActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    const cached = options?.force
      ? null
      : readCache<ActivityLog[]>(ACTIVITY_CACHE_KEY, ACTIVITY_CACHE_TTL);
    if (cached) {
      setLogs(cached);
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await dedupe(ACTIVITY_CACHE_KEY, async () => {
        const { data, error: fErr } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (fErr) throw fErr;
        return (data as ActivityRow[]).map(toLog);
      });
      writeCache(ACTIVITY_CACHE_KEY, list);
      setLogs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le journal.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(() => load(false, { force: true }), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const clearLogs = useCallback(async () => {
    const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
      body: { action: 'clear-activity' },
    });
    if (fnError) {
      const serverError = (fnError as { context?: { json?: { error?: string } } }).context?.json?.error;
      if (serverError) return { error: serverError };
      return { error: fnError.message };
    }
    const err = (data as { error?: string } | null)?.error;
    if (err) return { error: err };
    setLogs([]);
    writeCache(ACTIVITY_CACHE_KEY, []);
    return { error: null };
  }, []);

  return { logs, loading, error, fetchLogs, clearLogs };
}