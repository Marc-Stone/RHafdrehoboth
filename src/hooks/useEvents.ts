import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { notify } from '@/lib/notify';
import { nullIfEmpty } from '@/lib/errors';
import { subscribeRefresh } from '@/lib/refreshBus';
import { readCache, writeCache, invalidateCache, dedupe } from '@/lib/dataCache';
import { presentStatuses } from '@/lib/constants';
import { fetchAll } from '@/lib/fetchAll';
import type { ChurchEvent, EventInput, EventSessionInput } from '@/lib/types';

/** Clé de cache partagée entre toutes les pages qui lisent les événements. */
const EVENTS_CACHE_KEY = 'events:list';
const EVENTS_CACHE_TTL = 25_000;

interface EventRow {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  present_end_time: string | null;
  absent_start_time: string | null;
  location: string | null;
  description: string | null;
  community_id: string | null;
  closed_at: string | null;
  parent_event_id: string | null;
  is_container: boolean;
  communities: { name: string } | null;
  attendances: { status: string; members: { deleted_at: string | null } | null }[] | null;
}

function toEvent(row: EventRow): ChurchEvent {
  // Les pointages des membres supprimés sont exclus, comme dans la liste des
  // présences (sinon les compteurs d'un événement ne correspondaient pas).
  const attendanceRows = (row.attendances ?? []).filter((a) => !a.members?.deleted_at);
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time ?? '',
    endTime: row.end_time ?? '',
    presentEndTime: row.present_end_time ?? '',
    absentStartTime: row.absent_start_time ?? '',
    location: row.location ?? '',
    description: row.description ?? '',
    communityId: row.community_id,
    community: row.communities?.name ?? "Toute l'église",
    parentEventId: row.parent_event_id ?? null,
    parentTitle: '',
    isContainer: row.is_container ?? false,
    closedAt: row.closed_at ?? null,
    // Ne compte que les membres réellement présents (Présent / En retard),
    // et non les « Absent » générés lors de la clôture de l'événement.
    recordCount: attendanceRows.filter((a) => presentStatuses.includes(a.status)).length,
    // Détail par statut : permet d'afficher la répartition d'une session
    // (présents / absents) sans requête supplémentaire.
    absentCount: attendanceRows.filter((a) => a.status === 'Absent').length,
    excusedCount: attendanceRows.filter((a) => a.status === 'Absent en service').length,
    totalCount: attendanceRows.length,
  };
}

interface EventDbInput {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  present_end_time: string | null;
  absent_start_time: string | null;
  location: string | null;
  description: string | null;
  community_id: string | null;
  parent_event_id: string | null;
  is_container: boolean;
}

function toDb(input: EventInput, parentEventId: string | null, isContainer: boolean): EventDbInput {
  return {
    title: input.title,
    date: input.date,
    start_time: nullIfEmpty(input.startTime),
    end_time: nullIfEmpty(input.endTime),
    present_end_time: nullIfEmpty(input.presentEndTime),
    absent_start_time: nullIfEmpty(input.absentStartTime),
    location: nullIfEmpty(input.location),
    description: nullIfEmpty(input.description),
    community_id: input.communityId,
    parent_event_id: parentEventId,
    is_container: isContainer,
  };
}

function sessionToDb(session: EventSessionInput, date: string, input: EventInput, parentEventId: string): EventDbInput {
  return {
    title: session.title,
    date,
    start_time: nullIfEmpty(session.startTime),
    end_time: nullIfEmpty(session.endTime),
    present_end_time: nullIfEmpty(session.presentEndTime),
    absent_start_time: nullIfEmpty(session.absentStartTime),
    location: nullIfEmpty(input.location),
    description: nullIfEmpty(input.description),
    community_id: session.communityId || input.communityId || null,
    parent_event_id: parentEventId,
    is_container: false,
  };
}

export function useEvents() {
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    const cached = options?.force ? null : readCache<ChurchEvent[]>(EVENTS_CACHE_KEY, EVENTS_CACHE_TTL);
    if (cached) {
      setEvents(cached);
      hasLoadedRef.current = true;
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent || !hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const mapped = await dedupe(EVENTS_CACHE_KEY, async () => {
        // Lecture paginée : au-delà de 1000 événements la liste était tronquée.
        const data = await fetchAll<EventRow>((from, to) =>
          supabase
            .from('events')
            .select('*, communities(name), attendances(status, members(deleted_at))')
            .is('deleted_at', null)
            .order('date', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        );
        const mappedRows = data.map(toEvent);
        // Enrichit chaque session avec le titre de son événement parent
        // (affiché dans le scanner et les listes).
        const titleById = new Map(mappedRows.map((e) => [e.id, e.title]));
        return mappedRows.map((e) => ({
          ...e,
          parentTitle: e.parentEventId ? titleById.get(e.parentEventId) ?? '' : '',
        }));
      });
      writeCache(EVENTS_CACHE_KEY, mapped);
      setEvents(mapped);
      hasLoadedRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les événements.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Rechargement après mutation / clôture : cache invalidé puis relu. */
  const reload = useCallback(async () => {
    invalidateCache(EVENTS_CACHE_KEY);
    await load(true, { force: true });
  }, [load]);

  const fetchEvents = useCallback(() => load(false, { force: true }), [load]);

  useEffect(() => {
    void load(false);
    return subscribeRefresh(() => void reload());
  }, [load, reload]);

  const addEvent = async (input: EventInput) => {
    if (input.isContainer) {
      const { data: parent, error: pErr } = await supabase
        .from('events')
        .insert(toDb(input, null, true))
        .select('id')
        .single();
      if (pErr) return { error: pErr.message };
      const sessionRows = input.sessions.map((s) => sessionToDb(s, input.date, input, parent.id));
      const { error: sErr } = await supabase.from('events').insert(sessionRows);
      if (sErr) {
        // Évite de laisser un conteneur vide (orphelin) si les sessions échouent.
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', parent.id);
        return { error: sErr.message };
      }
    } else {
      const { error: insErr } = await supabase.from('events').insert(toDb(input, null, false));
      if (insErr) return { error: insErr.message };
    }
    await logActivity('ajout', `a créé l'événement « ${input.title} »`);
    await notify({ action: 'event-created', eventTitle: input.title, eventDate: input.date, communityId: input.communityId });
    await reload();
    return { error: null };
  };

  const updateEvent = async (id: string, input: EventInput) => {
    // Ancienne communauté du conteneur, avant modification : sert à propager
    // un changement aux sessions qui en héritaient.
    const { data: before } = await supabase
      .from('events')
      .select('community_id')
      .eq('id', id)
      .maybeSingle();
    const oldParentCommunity = before?.community_id ?? null;

    const { error: updErr } = await supabase
      .from('events')
      .update(toDb(input, null, input.isContainer))
      .eq('id', id);
    if (updErr) return { error: updErr.message };

    if (input.isContainer) {
      const keptIds = input.sessions.filter((s) => s.id).map((s) => s.id as string);
      // Toutes les sessions sont écrites en UNE seule requête (upsert).
      // Avant, chaque session était enregistrée séparément : un échec au
      // milieu laissait l'événement à moitié modifié (3 sessions sur 5).
      if (input.sessions.length > 0) {
        const rows = input.sessions.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          ...sessionToDb(s, input.date, input, id),
        }));
        const { error: sErr } = await supabase.from('events').upsert(rows);
        if (sErr) {
          await reload();
          return { error: `La modification des sessions a échoué : ${sErr.message}` };
        }
      }
      // Sessions retirées du formulaire : suppression logique.
      let removedQuery = supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('parent_event_id', id);
      if (keptIds.length > 0) removedQuery = removedQuery.not('id', 'in', `(${keptIds.join(',')})`);
      const { error: rmErr } = await removedQuery;
      if (rmErr) {
        await reload();
        return { error: rmErr.message };
      }
    } else {
      // L'événement n'est plus un conteneur : retirer d'éventuelles sessions résiduelles.
      const { error: rmErr } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('parent_event_id', id);
      if (rmErr) return { error: rmErr.message };
    }

    // Si la communauté du conteneur a changé, les sessions qui en héritaient
    // (elles portaient l'ancienne communauté) doivent suivre le nouveau parent,
    // tout en laissant intactes celles qui avaient une communauté propre.
    if (input.isContainer && oldParentCommunity !== (input.communityId ?? null)) {
      let prop = supabase
        .from('events')
        .update({ community_id: input.communityId ?? null })
        .eq('parent_event_id', id)
        .is('deleted_at', null);
      prop = oldParentCommunity
        ? prop.eq('community_id', oldParentCommunity)
        : prop.is('community_id', null);
      const { error: propErr } = await prop;
      if (propErr) return { error: propErr.message };
    }

    await logActivity('modification', `a modifié l'événement « ${input.title} »`);
    await notify({ action: 'event-updated', eventTitle: input.title, eventDate: input.date, communityId: input.communityId });
    await reload();
    return { error: null };
  };

  const deleteEvent = async (event: ChurchEvent) => {
    // Suppression LOGIQUE : les pointages sont conservés (même règle que la
    // page Présences). On masque d'abord l'événement et on vérifie qu'une
    // ligne a bien été modifiée (un refus des règles d'accès ne renvoie pas
    // d'erreur).
    const stamp = new Date().toISOString();
    const { data: hidden, error: delErr } = await supabase
      .from('events')
      .update({ deleted_at: stamp })
      .eq('id', event.id)
      .is('deleted_at', null)
      .select('id');
    if (delErr) return { error: delErr.message };
    if (!hidden || hidden.length === 0) {
      return { error: 'Suppression impossible : événement introuvable ou droits insuffisants.' };
    }
    const { error: sessErr } = await supabase
      .from('events')
      .update({ deleted_at: stamp })
      .eq('parent_event_id', event.id)
      .is('deleted_at', null);
    if (sessErr) {
      await supabase.from('events').update({ deleted_at: null }).eq('id', event.id);
      return { error: sessErr.message };
    }
    await logActivity('suppression', `a supprimé l'événement « ${event.title} »`);
    await reload();
    return { error: null };
  };

  return { events, loading, error, fetchEvents, addEvent, updateEvent, deleteEvent };
}