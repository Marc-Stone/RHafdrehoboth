import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { invalidateCache } from '@/lib/dataCache';
import { emitRefresh } from '@/lib/refreshBus';
import { fetchAll } from '@/lib/fetchAll';
import type { AttendanceStatus } from '@/lib/types';

const ATTENDANCES_CACHE_KEY = 'attendances:list';
const EVENTS_CACHE_KEY = 'events:list';

/** Taille maximale d'un envoi groupé (une église peut compter des milliers de membres). */
const INSERT_CHUNK = 400;

const VALID_STATUSES: AttendanceStatus[] = ['Présent', 'En retard', 'Absent en service', 'Absent'];

function normalizeStatus(status: string): AttendanceStatus {
  return (VALID_STATUSES as string[]).includes(status) ? (status as AttendanceStatus) : 'Présent';
}

interface SourceRow {
  member_id: string;
  status: string;
  members: { deleted_at: string | null } | null;
}

export interface InheritSummary {
  /** Membres exploitables dans la session source. */
  sourceTotal: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  /** Membres déjà enregistrés sur la session cible. */
  targetExisting: number;
  /** Membres qui seront réellement ajoutés à la session cible. */
  toAdd: number;
}

/**
 * Lecture des résultats d'une session source.
 * Les membres supprimés (suppression logique) sont écartés : reprendre leur
 * ligne recréerait des présences fantômes.
 */
async function readSourceRows(sourceEventId: string): Promise<{ rows: SourceRow[]; error: string | null }> {
  try {
    // Lecture paginée (au-delà de 1000 pointages la reprise était incomplète).
    const data = await fetchAll<SourceRow>((from, to) =>
      supabase
        .from('attendances')
        .select('member_id, status, members(deleted_at)')
        .eq('event_id', sourceEventId)
        .order('member_id')
        .range(from, to),
    );
    return { rows: data.filter((r) => !r.members?.deleted_at), error: null };
  } catch (e) {
    return { rows: [], error: (e as { message?: string })?.message ?? 'Lecture impossible.' };
  }
}

/** Identifiants des membres déjà présents sur une session (lecture paginée). */
async function readMemberIds(eventId: string): Promise<{ ids: Set<string>; error: string | null }> {
  try {
    const data = await fetchAll<{ member_id: string }>((from, to) =>
      supabase
        .from('attendances')
        .select('member_id')
        .eq('event_id', eventId)
        .order('member_id')
        .range(from, to),
    );
    return { ids: new Set(data.map((r) => r.member_id)), error: null };
  } catch (e) {
    return { ids: new Set(), error: (e as { message?: string })?.message ?? 'Lecture impossible.' };
  }
}

/**
 * Aperçu avant reprise : combien de membres seraient ajoutés et avec quels
 * statuts. Aucune écriture n'est faite ici.
 */
export async function fetchInheritSummary(
  sourceEventId: string,
  targetEventId: string,
): Promise<{ summary: InheritSummary | null; error: string | null }> {
  const { rows, error } = await readSourceRows(sourceEventId);
  if (error) return { summary: null, error };

  const { ids: targetIds, error: targetError } = await readMemberIds(targetEventId);
  if (targetError) return { summary: null, error: targetError };
  const pending = rows.filter((r) => !targetIds.has(r.member_id));

  const count = (status: AttendanceStatus) => rows.filter((r) => normalizeStatus(r.status) === status).length;

  return {
    summary: {
      sourceTotal: rows.length,
      present: count('Présent'),
      late: count('En retard'),
      excused: count('Absent en service'),
      absent: count('Absent'),
      targetExisting: targetIds.size,
      toAdd: pending.length,
    },
    error: null,
  };
}

export interface InheritResult {
  error: string | null;
  added: number;
  skipped: number;
}

/**
 * Reprend les résultats d'une session comme BASE de la session suivante.
 *
 * Règles respectées :
 * - seuls les statuts sont repris : aucune heure de pointage n'est copiée, donc
 *   les horaires de la session source ne contaminent jamais ceux de la cible ;
 * - les pointages déjà saisis sur la session cible sont conservés tels quels ;
 * - les deux sessions restent totalement indépendantes : modifier l'une après
 *   la reprise n'a aucun effet sur l'autre.
 */
export async function inheritSessionBase(params: {
  sourceEventId: string;
  sourceTitle: string;
  targetEventId: string;
  targetTitle: string;
  targetDate: string;
}): Promise<InheritResult> {
  const { sourceEventId, sourceTitle, targetEventId, targetTitle, targetDate } = params;

  // La session cible ne doit jamais être clôturée : ajouter des lignes dans un
  // événement verrouillé fausserait ses totaux sans possibilité de correction.
  const { data: targetEvent, error: targetErr } = await supabase
    .from('events')
    .select('id, closed_at')
    .eq('id', targetEventId)
    .maybeSingle();
  if (targetErr) return { error: targetErr.message, added: 0, skipped: 0 };
  if (!targetEvent) return { error: "La session cible est introuvable.", added: 0, skipped: 0 };
  if (targetEvent.closed_at) {
    return {
      error: 'Cette session est déjà clôturée : sa base ne peut plus être modifiée.',
      added: 0,
      skipped: 0,
    };
  }

  const { rows, error } = await readSourceRows(sourceEventId);
  if (error) return { error, added: 0, skipped: 0 };
  if (rows.length === 0) return { error: null, added: 0, skipped: 0 };

  const { ids: existingIds, error: existingError } = await readMemberIds(targetEventId);
  if (existingError) return { error: existingError, added: 0, skipped: 0 };
  const toInsert = rows
    .filter((r) => !existingIds.has(r.member_id))
    .map((r) => ({
      member_id: r.member_id,
      event_id: targetEventId,
      // Date de la session CIBLE : la reprise appartient à cette session.
      date: targetDate,
      // Aucune heure : c'est une base de travail, pas un pointage réel.
      check_in_time: null,
      method: 'Repris',
      scanned_by: null,
      status: normalizeStatus(r.status),
    }));

  const skipped = rows.length - toInsert.length;
  if (toInsert.length === 0) return { error: null, added: 0, skipped };

  let added = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    // `ignoreDuplicates` s'appuie sur l'unicité (membre + événement) : si un
    // membre vient d'être pointé sur la session cible entre l'aperçu et la
    // confirmation, sa ligne est simplement conservée au lieu de faire échouer
    // tout le lot (une insertion classique rejetait les 400 lignes du bloc).
    const { data: insertedRows, error: insErr } = await supabase
      .from('attendances')
      .upsert(chunk, { onConflict: 'member_id,event_id', ignoreDuplicates: true })
      .select('id');
    if (insErr) {
      invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
      emitRefresh();
      return {
        error: `La reprise s'est interrompue après ${added} membre(s) : ${insErr.message}`,
        added,
        skipped: rows.length - added,
      };
    }
    added += insertedRows?.length ?? 0;
  }

  invalidateCache(ATTENDANCES_CACHE_KEY, EVENTS_CACHE_KEY);
  await logActivity(
    'modification',
    `a repris les résultats de « ${sourceTitle} » comme base de « ${targetTitle} » (${added} membre(s))`,
  );
  emitRefresh();
  return { error: null, added, skipped: rows.length - added };
}