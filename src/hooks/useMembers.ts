import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { notify } from '@/lib/notify';
import { uploadChurchImage, removeChurchImage, uploadPrivateDocument, removePrivateDocument } from '@/lib/storage';
import { translateDbError, nullIfEmpty } from '@/lib/errors';
import { readCache, writeCache, invalidateCache, dedupe } from '@/lib/dataCache';
import { fetchAll } from '@/lib/fetchAll';
import type { Member, MemberInput, TrainingItem, EvaluationItem } from '@/lib/types';

/** Clé de cache partagée : évite de recharger toute la liste à chaque page. */
const MEMBERS_CACHE_KEY = 'members:list';
const MEMBERS_CACHE_TTL = 30_000;

interface MemberRow {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  commune: string | null;
  profession: string | null;
  marital_status: string | null;
  living_situation: string | null;
  integration_date: string | null;
  baptism_date: string | null;
  community_id: string | null;
  leader_name: string | null;
  department: string | null;
  church_role: string | null;
  matricule: string | null;
  status: string;
  photo_url: string | null;
  id_document_path: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  blood_group: string | null;
  allergies: string | null;
  talents: string | null;
  notes: string | null;
  trainings: TrainingItem[] | null;
  evaluations: EvaluationItem[] | null;
  communities: { name: string } | null;
}

interface MemberCommunityRow {
  member_id: string;
  community_id: string;
}

/**
 * Charge les communautés associées à une liste de membres (table de jointure).
 * On interroge `member_communities` séparément pour éviter les erreurs
 * d'imbrication PostgREST (relation non trouvée dans le cache du schéma).
 */
async function fetchMemberCommunities(memberIds: string[] | 'all'): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (memberIds !== 'all' && memberIds.length === 0) return map;
  let rows: MemberCommunityRow[] = [];
  try {
    // Pour la liste complète, on lit TOUTE la table de jointure page par page
    // (un filtre `in(...)` avec des milliers d'identifiants dépassait la
    // longueur d'URL autorisée, et la réponse était tronquée à 1000 lignes).
    rows = await fetchAll<MemberCommunityRow>((from, to) => {
      let q = supabase
        .from('member_communities')
        .select('member_id, community_id')
        .order('member_id')
        .order('community_id');
      if (memberIds !== 'all') q = q.in('member_id', memberIds);
      return q.range(from, to);
    });
  } catch {
    // Non bloquant : si la jointure est inaccessible, on retombe sur la
    // communauté principale du membre plutôt que de casser toute la liste.
    return map;
  }
  rows.forEach((row) => {
    const list = map.get(row.member_id) ?? [];
    list.push(row.community_id);
    map.set(row.member_id, list);
  });
  return map;
}

function normalizeTrainings(items: TrainingItem[] | null): TrainingItem[] {
  return (items ?? [])
    .filter((t) => t && typeof t === 'object')
    .map((t, i) => ({
      id: t.id || `training-${i}`,
      title: t.title ?? '',
      date: t.date ?? '',
      note: t.note ?? '',
    }));
}

function normalizeEvaluations(items: EvaluationItem[] | null): EvaluationItem[] {
  return (items ?? [])
    .filter((e) => e && typeof e === 'object')
    .map((e, i) => ({
      id: e.id || `evaluation-${i}`,
      year: e.year ?? '',
      result: e.result ?? '',
      note: e.note ?? '',
    }));
}

function toMember(row: MemberRow, communityIdsFromJoin: string[] = []): Member {
  // Fusionne la communauté principale avec les affectations additionnelles
  // (table de jointure) : évite de perdre la communauté principale quand la
  // jointure est incomplète (données héritées).
  const communityIds = Array.from(
    new Set([...(communityIdsFromJoin ?? []), ...(row.community_id ? [row.community_id] : [])]),
  );
  return {
    id: row.id,
    number: row.member_number ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    gender: row.gender ?? '',
    birthDate: row.birth_date,
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    neighborhood: row.neighborhood && row.neighborhood !== 'Anonyme' ? row.neighborhood : '',
    commune: row.commune && row.commune !== 'Anonyme' ? row.commune : '',
    profession: row.profession ?? '',
    maritalStatus: row.marital_status ?? '',
    livingSituation: row.living_situation ?? '',
    integrationDate: row.integration_date,
    baptismDate: row.baptism_date,
    communityId: row.community_id,
    communityIds,
    community: row.communities?.name ?? '—',
    leader: row.leader_name ?? '',
    department: row.department ?? '',
    churchRole: row.church_role ?? '',
    matricule: row.matricule ?? '',
    status: row.status as Member['status'],
    photoUrl: row.photo_url,
    idDocumentPath: row.id_document_path,
    emergencyContactName: row.emergency_contact_name ?? '',
    emergencyContactPhone: row.emergency_contact_phone ?? '',
    emergencyContactRelationship: row.emergency_contact_relationship ?? '',
    bloodGroup: row.blood_group ?? '',
    allergies: row.allergies ?? '',
    talents: row.talents ?? '',
    notes: row.notes ?? '',
    trainings: normalizeTrainings(row.trainings),
    evaluations: normalizeEvaluations(row.evaluations),
    medicalHistory: '',
  };
}

function toDb(input: MemberInput) {
  const primaryCommunity = input.communityIds.length > 0 ? input.communityIds[0] : null;
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    gender: nullIfEmpty(input.gender),
    birth_date: nullIfEmpty(input.birthDate),
    phone: nullIfEmpty(input.phone),
    email: nullIfEmpty(input.email),
    address: nullIfEmpty(input.address),
    neighborhood: nullIfEmpty(input.neighborhood),
    commune: nullIfEmpty(input.commune),
    profession: nullIfEmpty(input.profession),
    marital_status: nullIfEmpty(input.maritalStatus),
    living_situation: nullIfEmpty(input.livingSituation),
    integration_date: nullIfEmpty(input.integrationDate),
    baptism_date: nullIfEmpty(input.baptismDate),
    community_id: primaryCommunity,
    leader_name: nullIfEmpty(input.leader),
    department: nullIfEmpty(input.department),
    church_role: nullIfEmpty(input.churchRole),
    matricule: nullIfEmpty(input.matricule),
    status: input.status,
    emergency_contact_name: nullIfEmpty(input.emergencyContactName),
    emergency_contact_phone: nullIfEmpty(input.emergencyContactPhone),
    emergency_contact_relationship: nullIfEmpty(input.emergencyContactRelationship),
    blood_group: nullIfEmpty(input.bloodGroup),
    allergies: nullIfEmpty(input.allergies),
    talents: nullIfEmpty(input.talents),
    notes: nullIfEmpty(input.notes),
    trainings: input.trainings,
    evaluations: input.evaluations,
  };
}

const memberErrorMapping = {
  members_phone_unique: 'Ce numéro de téléphone est déjà utilisé par un autre membre.',
  members_email_unique: 'Cette adresse e-mail est déjà utilisée par un autre membre.',
  members_number_unique: 'Ce numéro de membre existe déjà.',
};

export function useMembers(options?: { autoLoad?: boolean }) {
  // Permet d'utiliser le hook pour ses actions (ex. fiche détail) sans
  // charger toute la liste des membres à chaque montage.
  const autoLoad = options?.autoLoad !== false;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    // Liste déjà chargée récemment : on la réutilise immédiatement, sans
    // requête ni spinner (navigation entre pages instantanée).
    const cached = options?.force ? null : readCache<Member[]>(MEMBERS_CACHE_KEY, MEMBERS_CACHE_TTL);
    if (cached) {
      setMembers(cached);
      hasLoadedRef.current = true;
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent || !hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      // `dedupe` : deux composants qui demandent la liste en même temps
      // déclenchent une seule requête réseau.
      const list = await dedupe(MEMBERS_CACHE_KEY, async () => {
        // Lecture paginée : au-delà de 1000 membres la liste était tronquée.
        const rows = await fetchAll<MemberRow>((from, to) =>
          supabase
            .from('members')
            .select('*, communities!members_community_id_fkey(name)')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        );
        const communityMap = await fetchMemberCommunities('all');
        return rows.map((row) => toMember(row, communityMap.get(row.id) ?? []));
      });
      writeCache(MEMBERS_CACHE_KEY, list);
      setMembers(list);
      hasLoadedRef.current = true;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      setError(message || 'Impossible de charger les membres.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Rechargement après une mutation : on invalide d'abord le cache partagé. */
  const reload = useCallback(async () => {
    invalidateCache(MEMBERS_CACHE_KEY);
    await load(true, { force: true });
  }, [load]);

  const fetchMembers = useCallback(() => load(false, { force: true }), [load]);

  useEffect(() => {
    if (autoLoad) void load(false);
  }, [load, autoLoad]);

  /**
   * Synchronise les communautés d'un membre de façon incrémentale :
   * on ajoute d'abord les nouvelles affectations, PUIS on retire les anciennes.
   * Ainsi, un échec d'insertion ne vide jamais les communautés existantes.
   */
  const syncMemberCommunities = async (memberId: string, communityIds: string[]) => {
    const desired = Array.from(new Set(communityIds));
    const { data: existing, error: readErr } = await supabase
      .from('member_communities')
      .select('community_id')
      .eq('member_id', memberId);
    if (readErr) return { error: readErr.message };
    const existingIds = ((existing ?? []) as { community_id: string }[]).map((r) => r.community_id);
    const toAdd = desired.filter((id) => !existingIds.includes(id));
    const toRemove = existingIds.filter((id) => !desired.includes(id));

    if (toAdd.length > 0) {
      const { error: insErr } = await supabase
        .from('member_communities')
        .insert(toAdd.map((cid) => ({ member_id: memberId, community_id: cid })));
      if (insErr) return { error: insErr.message };
    }
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('member_communities')
        .delete()
        .eq('member_id', memberId)
        .in('community_id', toRemove);
      if (delErr) return { error: delErr.message };
    }
    return { error: null };
  };

  const saveMemberMedical = async (memberId: string, history: string) => {
    const trimmed = history.trim();
    try {
      if (trimmed) {
        const { error: medErr } = await supabase.from('member_medical').upsert(
          { member_id: memberId, medical_history: trimmed, updated_at: new Date().toISOString() },
          { onConflict: 'member_id' },
        );
        if (!medErr) {
          await logActivity('modification', 'a mis à jour les antécédents médicaux');
        }
      } else {
        await supabase.from('member_medical').delete().eq('member_id', memberId);
      }
    } catch {
      // La RLS peut bloquer l'accès pour certains rôles : on ne casse jamais la sauvegarde.
    }
  };

  const addMember = async (input: MemberInput) => {
    const { data: inserted, error: insErr } = await supabase
      .from('members')
      .insert(toDb(input))
      .select('id, member_number')
      .single();
    if (insErr) return { error: translateDbError(insErr.message, memberErrorMapping) };

    const memberId = inserted.id;
    const number = inserted.member_number ?? memberId;

    // Une erreur d'affectation ne doit jamais passer inaperçue : sans
    // communautés, le membre disparaît des statistiques et du ciblage.
    const syncResult = await syncMemberCommunities(memberId, input.communityIds);
    const communityError = syncResult.error
      ? `Le membre a été créé, mais l'affectation aux communautés a échoué : ${syncResult.error}`
      : null;

    const mediaWarnings: string[] = [];

    if (input.photoDataUrl) {
      try {
        const url = await uploadChurchImage(`members/${number}`, input.photoDataUrl);
        const { error: phErr } = await supabase.from('members').update({ photo_url: url }).eq('id', memberId);
        if (phErr) mediaWarnings.push(`La photo n'a pas pu être enregistrée : ${phErr.message}`);
      } catch (e) {
        mediaWarnings.push(
          `La photo n'a pas pu être envoyée : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
        );
      }
    }
    if (input.idDocumentDataUrl) {
      try {
        const path = await uploadPrivateDocument(`documents/${number}`, input.idDocumentDataUrl);
        const { error: docErr } = await supabase.from('members').update({ id_document_path: path }).eq('id', memberId);
        if (docErr) mediaWarnings.push(`La pièce d'identité n'a pas pu être enregistrée : ${docErr.message}`);
      } catch (e) {
        mediaWarnings.push(
          `La pièce d'identité n'a pas pu être envoyée : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
        );
      }
    }

    if (input.saveMedical !== false) {
      await saveMemberMedical(memberId, input.medicalHistory);
    }

    await logActivity('ajout', `a ajouté le membre ${input.firstName} ${input.lastName}`);
    await notify({ action: 'member-added', memberName: `${input.firstName} ${input.lastName}`, communityId: input.communityIds[0] ?? null });
    await reload();
    return { error: [communityError, ...mediaWarnings].filter(Boolean).join(' ') || null };
  };

  const updateMember = async (id: string, input: MemberInput) => {
    const prev = members.find((m) => m.id === id);
    const number = prev?.number ?? id;

    const { error: updErr } = await supabase.from('members').update(toDb(input)).eq('id', id);
    if (updErr) return { error: translateDbError(updErr.message, memberErrorMapping) };

    const syncResult = await syncMemberCommunities(id, input.communityIds);
    const communityError = syncResult.error
      ? `La fiche a été enregistrée, mais l'affectation aux communautés a échoué : ${syncResult.error}`
      : null;

    const mediaWarnings: string[] = [];

    if (input.photoRemoved) {
      try {
        await removeChurchImage(`members/${number}`);
      } catch {
        // fichier absent
      }
      await supabase.from('members').update({ photo_url: null }).eq('id', id);
    } else if (input.photoDataUrl) {
      try {
        const url = await uploadChurchImage(`members/${number}`, input.photoDataUrl);
        const { error: phErr } = await supabase.from('members').update({ photo_url: url }).eq('id', id);
        if (phErr) mediaWarnings.push(`La photo n'a pas pu être enregistrée : ${phErr.message}`);
      } catch (e) {
        mediaWarnings.push(
          `La photo n'a pas pu être envoyée : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
        );
      }
    }

    if (input.idDocumentRemoved) {
      try {
        await removePrivateDocument(`documents/${number}`);
      } catch {
        // fichier absent
      }
      await supabase.from('members').update({ id_document_path: null }).eq('id', id);
    } else if (input.idDocumentDataUrl) {
      try {
        const path = await uploadPrivateDocument(`documents/${number}`, input.idDocumentDataUrl);
        const { error: docErr } = await supabase.from('members').update({ id_document_path: path }).eq('id', id);
        if (docErr) mediaWarnings.push(`La pièce d'identité n'a pas pu être enregistrée : ${docErr.message}`);
      } catch (e) {
        mediaWarnings.push(
          `La pièce d'identité n'a pas pu être envoyée : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
        );
      }
    }

    if (input.saveMedical !== false) {
      await saveMemberMedical(id, input.medicalHistory);
    }

    await logActivity('modification', `a modifié le membre ${input.firstName} ${input.lastName}`);
    if (input.status === 'Suspendu' && prev?.status !== 'Suspendu') {
      await notify({ action: 'member-suspended', memberName: `${input.firstName} ${input.lastName}`, communityId: input.communityIds[0] ?? null });
    }
    await reload();
    return { error: [communityError, ...mediaWarnings].filter(Boolean).join(' ') || null };
  };

  const deleteMember = async (member: Member) => {
    // On conserve l'historique de présence mais on le détache de la liste
    // courante : les pointages d'un membre supprimé ne doivent plus être
    // affichés ni comptés (voir le filtrage dans useAttendances).
    const { error: delErr } = await supabase
      .from('members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', member.id);
    if (delErr) return { error: delErr.message };
    await logActivity('suppression', `a supprimé le membre ${member.firstName} ${member.lastName} (${member.number})`);
    await reload();
    return { error: null };
  };

  const findMemberByNumber = useCallback(async (number: string): Promise<Member | null> => {
    const { data } = await supabase
      .from('members')
      .select('*, communities!members_community_id_fkey(name)')
      .eq('member_number', number)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return null;
    const row = data as MemberRow;
    const map = await fetchMemberCommunities([row.id]);
    return toMember(row, map.get(row.id) ?? []);
  }, []);

  /**
   * Charge les antécédents médicaux d'un membre (table séparée, RLS restreint).
   * Renvoie une chaîne vide si non autorisé ou non renseigné.
   */
  const fetchMedicalHistory = useCallback(async (memberId: string): Promise<string> => {
    const { data } = await supabase
      .from('member_medical')
      .select('medical_history')
      .eq('member_id', memberId)
      .maybeSingle();
    return data?.medical_history ?? '';
  }, []);

  const updateMemberPhoto = async (
    id: string,
    number: string,
    dataUrl: string,
  ): Promise<{ error: string | null }> => {
    const pathKey = number || id;
    try {
      const url = await uploadChurchImage(`members/${pathKey}`, dataUrl);
      const { error: updErr } = await supabase.from('members').update({ photo_url: url }).eq('id', id);
      if (updErr) {
        return {
          error: `L'image a été envoyée mais la fiche n'a pas pu être mise à jour : ${updErr.message}`,
        };
      }
      if (autoLoad) await reload();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Impossible d'enregistrer la photo." };
    }
  };

  const removeMemberPhoto = async (
    id: string,
    number: string,
  ): Promise<{ error: string | null }> => {
    const pathKey = number || id;
    try {
      await removeChurchImage(`members/${pathKey}`);
    } catch {
      // fichier absent, on continue
    }
    const { error: updErr } = await supabase.from('members').update({ photo_url: null }).eq('id', id);
    if (updErr) return { error: `La fiche n'a pas pu être mise à jour : ${updErr.message}` };
    if (autoLoad) await reload();
    return { error: null };
  };

  return { members, loading, error, fetchMembers, addMember, updateMember, deleteMember, findMemberByNumber, fetchMedicalHistory, updateMemberPhoto, removeMemberPhoto };
}