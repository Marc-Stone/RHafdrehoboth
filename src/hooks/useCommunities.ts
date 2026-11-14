import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { translateDbError, nullIfEmpty } from '@/lib/errors';
import { readCache, writeCache, invalidateCache, dedupe } from '@/lib/dataCache';
import type { Community } from '@/lib/types';

/** Les communautés changent peu : un cache court évite les rechargements inutiles
 * (sidebar, formulaires, filtres et tableaux de bord les demandent tous). */
const COMMUNITIES_CACHE_KEY = 'communities:list';
const COMMUNITIES_CACHE_TTL = 60_000;

interface LeaderRef {
  full_name: string | null;
}

interface CommunityRow {
  id: string;
  name: string;
  leader_id: string | null;
  leader: LeaderRef | null;
  description: string | null;
  type: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  meeting_location: string | null;
  icon: string | null;
}

function toCommunity(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    leader: row.leader?.full_name ?? '',
    description: row.description ?? '',
    type: row.type ?? 'Groupe',
    meetingDay: row.meeting_day ?? '',
    meetingTime: row.meeting_time ?? '',
    meetingLocation: row.meeting_location ?? '',
    icon: row.icon ?? 'ri-group-line',
  };
}

export interface CommunityInput {
  name: string;
  description: string;
  type: string;
  meetingDay: string;
  meetingTime: string;
  meetingLocation: string;
  icon: string;
}

function toDb(input: CommunityInput) {
  return {
    name: input.name,
    description: nullIfEmpty(input.description),
    type: nullIfEmpty(input.type),
    meeting_day: nullIfEmpty(input.meetingDay),
    meeting_time: nullIfEmpty(input.meetingTime),
    meeting_location: nullIfEmpty(input.meetingLocation),
    icon: nullIfEmpty(input.icon),
  };
}

export function useCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    const cached = options?.force
      ? null
      : readCache<Community[]>(COMMUNITIES_CACHE_KEY, COMMUNITIES_CACHE_TTL);
    if (cached) {
      setCommunities(cached);
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await dedupe(COMMUNITIES_CACHE_KEY, async () => {
        const { data, error: fErr } = await supabase
          .from('communities')
          .select('*, leader:profiles!communities_leader_id_fkey(full_name)')
          .is('deleted_at', null)
          .order('name', { ascending: true });
        if (fErr) throw fErr;
        return (data as CommunityRow[]).map(toCommunity);
      });
      writeCache(COMMUNITIES_CACHE_KEY, list);
      setCommunities(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les communautés.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Rechargement silencieux après une mutation (sans repasser par le spinner). */
  const refresh = useCallback(async () => {
    invalidateCache(COMMUNITIES_CACHE_KEY);
    await load(true, { force: true });
  }, [load]);

  const fetchCommunities = useCallback(() => load(false, { force: true }), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const addCommunity = async (input: CommunityInput) => {
    const { error: insErr } = await supabase.from('communities').insert(toDb(input));
    if (insErr) {
      return {
        error: translateDbError(insErr.message, {
          communities_name_unique: 'Une communauté porte déjà ce nom.',
        }),
      };
    }
    await logActivity('ajout', `a créé la communauté « ${input.name} »`);
    await refresh();
    return { error: null };
  };

  const updateCommunity = async (id: string, input: CommunityInput) => {
    const { error: updErr } = await supabase.from('communities').update(toDb(input)).eq('id', id);
    if (updErr) {
      return {
        error: translateDbError(updErr.message, {
          communities_name_unique: 'Une communauté porte déjà ce nom.',
        }),
      };
    }
    await logActivity('modification', `a modifié la communauté « ${input.name} »`);
    await refresh();
    return { error: null };
  };

  const deleteCommunity = async (community: Community) => {
    // Détacher d'abord les membres et les responsables : sinon ils gardaient
    // le nom d'une communauté qui n'existe plus, et les filtres ne la
    // proposaient plus (incohérence entre fiche membre et listes).
    const { error: memberCommunitiesErr } = await supabase
      .from('member_communities')
      .delete()
      .eq('community_id', community.id);
    if (memberCommunitiesErr) return { error: memberCommunitiesErr.message };

    const { error: membersErr } = await supabase
      .from('members')
      .update({ community_id: null })
      .eq('community_id', community.id);
    if (membersErr) return { error: membersErr.message };

    const { error: leadersErr } = await supabase
      .from('leader_communities')
      .delete()
      .eq('community_id', community.id);
    if (leadersErr) return { error: leadersErr.message };

    // Les responsables qui avaient cette communauté comme communauté
    // principale doivent aussi être détachés.
    const { error: profilesErr } = await supabase
      .from('profiles')
      .update({ community_id: null })
      .eq('community_id', community.id);
    if (profilesErr) return { error: profilesErr.message };

    const { error: delErr } = await supabase
      .from('communities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', community.id);
    if (delErr) return { error: delErr.message };
    await logActivity('suppression', `a supprimé la communauté « ${community.name} »`);
    await refresh();
    return { error: null };
  };

  return { communities, loading, error, fetchCommunities, addCommunity, updateCommunity, deleteCommunity };
}