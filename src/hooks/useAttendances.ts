import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { getCurrentUserId } from '@/lib/currentUser';
import { computeAttendanceStatus, isFutureDay, isPastEndAt } from '@/lib/attendanceStatus';
import { closeEventInDb } from '@/lib/eventClosure';
import { serverNow, wallClock } from '@/lib/serverClock';
import { fetchAll } from '@/lib/fetchAll';
import { resolveEventCommunityId } from '@/lib/eventScope';
import { subscribeRefresh } from '@/lib/refreshBus';
import { readCache, writeCache, invalidateCache, dedupe } from '@/lib/dataCache';
import type { AttendanceRecord, AttendanceStatus, Member } from '@/lib/types';

/** Clé de cache partagée : tableau de bord, présences et rapports réutilisent
 * la même lecture au lieu de la refaire chacun de leur côté. */
const ATTENDANCES_CACHE_KEY = 'attendances:list';
const EVENTS_CACHE_KEY = 'events:list';
const ATTENDANCES_CACHE_TTL = 20_000;

interface AttendanceRow {
  id: string;
  member_id: string;
  check_in_time: string | null;
  method: string;
  status: string;
  scanned_by: string | null;
  members: {
    member_number: string;
    first_name: string;
    last_name: string;
    deleted_at: string | null;
    communities: { name: string } | null;
  } | null;
  events: { id: string; title: string; date: string; closed_at: string | null } | null;
  profiles: { full_name: string } | null;
}

const RECORD_SELECT =
  'id, member_id, check_in_time, method, status, scanned_by, members(member_number, first_name, last_name, deleted_at, communities!members_community_id_fkey(name)), events!inner(id, title, date, closed_at), profiles!attendances_scanned_by_fkey(full_name)';

function toRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    memberNumber: row.members?.member_number ?? '',
    memberName: `${row.members?.first_name ?? ''} ${row.members?.last_name ?? ''}`.trim(),
    community: row.members?.communities?.name ?? '—',
    method: row.method === 'Manuel' ? 'Manuel' : row.method === 'Repris' ? 'Repris' : 'QR',
    time: row.check_in_time ?? '',
    eventId: row.events?.id ?? '',
    eventTitle: row.events?.title ?? '',
    eventDate: row.events?.date ?? '',
    eventClosed: Boolean(row.events?.closed_at),
    scannedBy: row.scanned_by ?? '',
    scannedByName: row.profiles?.full_name ?? '',
    status: (row.status as AttendanceStatus) ?? 'Présent',
  };
}

interface EventForCheckIn {
  date: string;
  start_time: string | null;
  end_time: string | null;
  present_end_time: string | null;
  absent_start_time: string | null;
  community_id: string | null;
  parent_event_id: string | null;
  closed_at: string | null;
  deleted_at: string | null;
  is_container: boolean | null;
}

export function useAttendances() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Un rechargement en arrière-plan (rafraîchissement, mutation) ne doit PAS
  // réafficher le spinner plein écran : on ne le montre qu'au tout premier
  // chargement ou lors d'un « Réessayer » explicite.
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    const cached = options?.force
      ? null
      : readCache<AttendanceRecord[]>(ATTENDANCES_CACHE_KEY, ATTENDANCES_CACHE_TTL);
    if (cached) {
      setRecords(cached);
      hasLoadedRef.current = true;
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent || !hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const list = await dedupe(ATTENDANCES_CACHE_KEY, async () => {
        // Lecture paginée : sans cela, au-delà de 1000 pointages la liste
        // (donc tableaux de bord et rapports) était tronquée sans message.
        const data = await fetchAll<AttendanceRow>((from, to) =>
          supabase
            .from('attendances')
            .select(RECORD_SELECT)
            // Les pointages d'événements supprimés (suppression logique) ne doivent
            // plus apparaître dans les listes, les rapports ni les tableaux de bord.
            .is('events.deleted_at', null)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        );
        // Un membre supprimé (suppression logique) ne doit plus apparaître dans
        // les présences, les rapports ni les compteurs du jour.
        return data
          .filter((row) => !row.members?.deleted_at)
          .map(toRecord);
      });
      writeCache(ATTENDANCES_CACHE_KEY, list);
      setRecords(list);
      hasLoadedRef.current = true;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      setError(message || 'Impossible de charger les présences.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Rechargement après mutation : le cache partagé est invalidé d'abord. */
  const reload = useCallback(async () => {
    invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
    await load(true, { force: true });
  }, [load]);

  const fetchRecords = useCallback(() => load(false, { force: true }), [load]);

  /**
   * Récupère UN pointage (avec ses relations) après insertion.
   * Évite de recharger les centaines/milliers de pointages de l'église à
   * chaque scan : on n'ajoute que la ligne concernée à l'état local.
   */
  const fetchRecordById = useCallback(async (id: string): Promise<AttendanceRecord | null> => {
    const { data, error: rErr } = await supabase
      .from('attendances')
      .select(RECORD_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (rErr || !data) return null;
    const row = data as unknown as AttendanceRow;
    if (row.members?.deleted_at) return null;
    return toRecord(row);
  }, []);

  useEffect(() => {
    void load(false);
    return subscribeRefresh(() => void reload());
  }, [load, reload]);

  type GuardResult = 'ok' | 'error' | 'closed' | 'not_started' | 'wrong_community';

  /**
   * Contrôles communs à toute écriture de pointage. L'événement est relu en
   * base : s'il est introuvable (erreur, droits), supprimé ou est un conteneur,
   * on REFUSE (avant, un événement introuvable laissait passer le pointage
   * sans aucun contrôle).
   */
  const loadEventGuard = async (
    eventId: string,
    member: Member | null,
  ): Promise<{ result: GuardResult; evt: EventForCheckIn | null; now: number }> => {
    const now = await serverNow();
    const { data, error: evtErr } = await supabase
      .from('events')
      .select('date, start_time, end_time, present_end_time, absent_start_time, community_id, parent_event_id, closed_at, deleted_at, is_container')
      .eq('id', eventId)
      .maybeSingle();
    const evt = (data as EventForCheckIn | null) ?? null;
    if (evtErr || !evt || evt.deleted_at || evt.is_container) return { result: 'error', evt: null, now };

    if (member) {
      // Communauté effective (héritée du parent pour une session sans communauté).
      const effectiveCommunityId = await resolveEventCommunityId(evt.community_id, evt.parent_event_id);
      if (effectiveCommunityId && !member.communityIds.includes(effectiveCommunityId)) {
        return { result: 'wrong_community', evt, now };
      }
    }

    // Événement clôturé (manuellement ou automatiquement) : pointage bloqué.
    if (evt.closed_at) return { result: 'closed', evt, now };
    if (isPastEndAt({ date: evt.date, endTime: evt.end_time, absentStartTime: evt.absent_start_time }, now)) {
      return { result: 'closed', evt, now };
    }
    // Événement d'un jour futur : pointer maintenant enregistrait le membre
    // « Présent » plusieurs jours à l'avance.
    if (isFutureDay(evt.date, now)) return { result: 'not_started', evt, now };

    return { result: 'ok', evt, now };
  };

  /** Heure de pointage « HH:MM » à l'heure de l'église (horloge serveur). */
  const checkInTime = (now: number) => wallClock(now).time.slice(0, 5);

  const checkIn = async (eventId: string, member: Member, method: 'QR' | 'Manuel') => {
    // Seuls les membres actifs participent au pointage : pointer un membre
    // inactif/suspendu gonflait le numérateur sans le dénominateur (taux > 100 %).
    if (member.status !== 'Actif') return 'inactive';

    // Identifiant lu depuis la session locale (aucun appel réseau).
    const userId = await getCurrentUserId();

    const guard = await loadEventGuard(eventId, member);
    if (guard.result !== 'ok' || !guard.evt) return guard.result;
    const evt = guard.evt;

    // Statut calculé selon les seuils de l'événement, avec l'heure du serveur
    // exprimée dans le fuseau de l'église.
    const status: AttendanceStatus = computeAttendanceStatus(
      {
        date: evt.date,
        startTime: evt.start_time,
        presentEndTime: evt.present_end_time,
        absentStartTime: evt.absent_start_time,
      },
      guard.now,
    );

    const { data: inserted, error: insErr } = await supabase
      .from('attendances')
      .insert({
        member_id: member.id,
        event_id: eventId,
        // Date de l'ÉVÉNEMENT (et non du jour) pour des analyses par date justes.
        date: evt.date,
        check_in_time: checkInTime(guard.now),
        method,
        scanned_by: userId,
        status,
      })
      .select('id')
      .single();
    if (insErr) {
      if (insErr.message.includes('attendances_unique_member_event')) return 'duplicate';
      return 'error';
    }
    await logActivity('pointage', `a pointé ${member.firstName} ${member.lastName} (${method} · ${status})`);
    // Ajout local du seul pointage créé (au lieu d'un rechargement complet).
    const record = inserted?.id ? await fetchRecordById(inserted.id as string) : null;
    if (record) {
      setRecords((cur) => [record, ...cur.filter((r) => r.id !== record.id)]);
      invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
    } else {
      await reload();
    }
    return 'ok';
  };

  /**
   * Marque un membre comme « Absent en service » (excusé / en service).
   * À la clôture, ce membre possède déjà un pointage, il est donc exclu
   * du marquage automatique « Absent » des non-pointés.
   */
  const markAbsentInService = async (eventId: string, member: Member) => {
    if (member.status !== 'Actif') return 'inactive';

    const userId = await getCurrentUserId();
    const guard = await loadEventGuard(eventId, member);
    // Déclarer un membre « en service » à l'avance reste autorisé (planning).
    if (guard.result !== 'ok' && guard.result !== 'not_started') return guard.result;
    if (!guard.evt) return 'error';

    const { data: inserted, error: insErr } = await supabase
      .from('attendances')
      .insert({
        member_id: member.id,
        event_id: eventId,
        date: guard.evt.date,
        check_in_time: checkInTime(guard.now),
        method: 'Manuel',
        scanned_by: userId,
        status: 'Absent en service',
      })
      .select('id')
      .single();
    if (insErr) {
      if (insErr.message.includes('attendances_unique_member_event')) return 'duplicate';
      return 'error';
    }
    await logActivity('pointage', `a marqué ${member.firstName} ${member.lastName} comme absent en service`);
    const record = inserted?.id ? await fetchRecordById(inserted.id as string) : null;
    if (record) {
      setRecords((cur) => [record, ...cur.filter((r) => r.id !== record.id)]);
      invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
    } else {
      await reload();
    }
    return 'ok';
  };

  const removeRecord = async (recordId: string) => {
    const { data: deleted, error: delErr } = await supabase
      .from('attendances')
      .delete()
      .eq('id', recordId)
      .select('id');
    if (delErr) return { error: delErr.message };
    // Une suppression filtrée par les règles d'accès ne renvoie aucune erreur.
    if (!deleted || deleted.length === 0) {
      return { error: "Suppression impossible : vous n'avez pas les droits sur ce pointage." };
    }
    await reload();
    return { error: null };
  };

  const updateRecordStatus = async (recordId: string, status: AttendanceStatus) => {
    // Mise à jour optimiste ; l'ancien statut est lu AVANT l'appel pour un
    // retour arrière fiable en cas d'erreur.
    const previous = records.find((r) => r.id === recordId)?.status;
    setRecords((cur) => cur.map((r) => (r.id === recordId ? { ...r, status } : r)));
    invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
    const { data: updated, error: updErr } = await supabase
      .from('attendances')
      .update({ status })
      .eq('id', recordId)
      .select('id');
    if (updErr) {
      if (previous) {
        setRecords((cur) => cur.map((r) => (r.id === recordId ? { ...r, status: previous } : r)));
      }
      return { error: updErr.message };
    }
    if (!updated || updated.length === 0) {
      if (previous) {
        setRecords((cur) => cur.map((r) => (r.id === recordId ? { ...r, status: previous } : r)));
      }
      return { error: "Modification refusée : vous n'avez pas les droits sur ce pointage." };
    }
    return { error: null };
  };

  /**
   * Transforme un pointage « de base » (résultat repris d'une session
   * précédente, ou absence) en pointage réel pour CET événement.
   * La ligne est mise à jour au lieu d'en créer une seconde (contrainte
   * d'unicité membre + événement).
   */
  const promoteRecord = async (
    recordId: string,
    eventId: string,
    method: 'QR' | 'Manuel',
  ): Promise<'ok' | 'closed' | 'not_started' | 'forbidden' | 'error'> => {
    const guard = await loadEventGuard(eventId, null);
    if (guard.result === 'closed' || guard.result === 'not_started') return guard.result;
    if (guard.result !== 'ok' || !guard.evt) return 'error';
    const evt = guard.evt;

    const userId = await getCurrentUserId();
    const status = computeAttendanceStatus(
      {
        date: evt.date,
        startTime: evt.start_time,
        presentEndTime: evt.present_end_time,
        absentStartTime: evt.absent_start_time,
      },
      guard.now,
    );

    const { data: updated, error: updErr } = await supabase
      .from('attendances')
      .update({ check_in_time: checkInTime(guard.now), method, status, scanned_by: userId })
      .eq('id', recordId)
      // La ligne doit bien appartenir à l'événement en cours.
      .eq('event_id', eventId)
      .select('id');
    if (updErr) return 'error';
    // Mise à jour filtrée par les règles d'accès : signalée explicitement.
    if (!updated || updated.length === 0) return 'forbidden';

    const record = await fetchRecordById(recordId);
    if (record) {
      setRecords((cur) => cur.map((r) => (r.id === recordId ? record : r)));
    } else {
      await reload();
    }
    invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
    return 'ok';
  };

  /** Clôture (côté serveur) : marque les absents puis verrouille l'événement. */
  const closeEvent = async (eventId: string): Promise<{ error: string | null; markedAbsent: number }> => {
    const res = await closeEventInDb(eventId);
    if (!res.error) await reload();
    return res;
  };

  /**
   * Suppression LOGIQUE d'un événement (et de ses sessions s'il s'agit d'un
   * conteneur). Les pointages sont conservés en base mais n'apparaissent plus
   * nulle part (filtre `events.deleted_at`). Même comportement que la page
   * Événements : avant, cette page détruisait définitivement les pointages
   * alors que l'autre les conservait.
   */
  const deleteEvent = async (eventId: string, eventTitle: string) => {
    const stamp = new Date().toISOString();
    const { data: hiddenRows, error: evtErr } = await supabase
      .from('events')
      .update({ deleted_at: stamp })
      .eq('id', eventId)
      .is('deleted_at', null)
      .select('id');
    if (evtErr) return { error: evtErr.message };
    if (!hiddenRows || hiddenRows.length === 0) {
      return { error: 'Suppression impossible : événement introuvable ou droits insuffisants.' };
    }

    // Sessions d'un événement en plusieurs parties : masquées aussi.
    const { error: sessErr } = await supabase
      .from('events')
      .update({ deleted_at: stamp })
      .eq('parent_event_id', eventId)
      .is('deleted_at', null);
    if (sessErr) {
      await supabase.from('events').update({ deleted_at: null }).eq('id', eventId);
      return { error: sessErr.message };
    }

    await logActivity('suppression', `a supprimé l'événement « ${eventTitle} »`);
    await reload();
    return { error: null };
  };

  return { records, loading, error, fetchRecords, checkIn, markAbsentInService, promoteRecord, removeRecord, updateRecordStatus, closeEvent, deleteEvent };
}
