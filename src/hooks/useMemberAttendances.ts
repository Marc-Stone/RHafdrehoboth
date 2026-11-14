import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AttendanceStatus } from '@/lib/types';

/**
 * Présences d'UN SEUL membre.
 * Évite de recharger l'intégralité des pointages de l'église quand on ouvre
 * la fiche d'un membre ou l'onglet « Suivi » de son formulaire.
 */
export interface MemberAttendance {
  id: string;
  memberId: string;
  method: 'QR' | 'Manuel' | 'Repris';
  time: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  status: AttendanceStatus;
}

interface Row {
  id: string;
  member_id: string;
  check_in_time: string | null;
  method: string;
  status: string;
  events: { id: string; title: string; date: string } | null;
}

export function useMemberAttendances(memberId: string | null | undefined) {
  const [records, setRecords] = useState<MemberAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberId) {
      setRecords([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fErr } = await supabase
        .from('attendances')
        .select('id, member_id, check_in_time, method, status, events!inner(id, title, date)')
        .eq('member_id', memberId)
        // Les pointages rattachés à un événement supprimé (suppression logique)
        // ne doivent pas apparaître dans l'historique du membre.
        .is('events.deleted_at', null)
        .order('created_at', { ascending: false });
      if (fErr) throw fErr;
      const rows = (data ?? []) as unknown as Row[];
      setRecords(
        rows.map((r) => ({
          id: r.id,
          memberId: r.member_id,
          method: r.method === 'Manuel' ? 'Manuel' : r.method === 'Repris' ? 'Repris' : 'QR',
          time: r.check_in_time ?? '',
          eventId: r.events?.id ?? '',
          eventTitle: r.events?.title ?? '',
          eventDate: r.events?.date ?? '',
          status: (r.status as AttendanceStatus) ?? 'Présent',
        })),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      setError(message || 'Impossible de charger les présences de ce membre.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { records, loading, error, reload: load };
}