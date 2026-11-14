import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { readCache, writeCache, invalidateCache, dedupe } from '@/lib/dataCache';
import type { UserRole } from '@/hooks/useAuth';

const USERS_CACHE_KEY = 'profiles:list';
const USERS_CACHE_TTL = 20_000;

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
  community_id: string | null;
  community_ids: string[];
  /** Compte activé. `false` = connexion refusée. */
  is_active: boolean;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
  community_id: string | null;
  is_active: boolean | null;
}

export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (options?: { force?: boolean }) => {
    const cached = options?.force === true
      ? null
      : readCache<AdminUser[]>(USERS_CACHE_KEY, USERS_CACHE_TTL);
    if (cached) {
      setUsers(cached);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mapped = await dedupe(USERS_CACHE_KEY, async () => {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, created_at, community_id, is_active')
          .order('created_at', { ascending: false });
        if (fetchError) throw fetchError;

        // Affectations multi-communautés des responsables (table de liaison).
        // Le super admin voit tout via `can_manage_data()` ; en cas d'erreur on
        // retombe sur la communauté principale sans casser la liste.
        let communitiesByLeader = new Map<string, string[]>();
        try {
          const { data: lcData } = await supabase
            .from('leader_communities')
            .select('leader_id, community_id');
          communitiesByLeader = new Map<string, string[]>();
          ((lcData ?? []) as { leader_id: string; community_id: string }[]).forEach((row) => {
            const list = communitiesByLeader.get(row.leader_id) ?? [];
            list.push(row.community_id);
            communitiesByLeader.set(row.leader_id, list);
          });
        } catch {
          // jointure inaccessible : on ignore silencieusement.
        }

        const rows = (data ?? []) as ProfileRow[];
        return rows.map((u) => ({
          ...u,
          is_active: u.is_active !== false,
          community_ids: communitiesByLeader.get(u.id) ?? [],
        }));
      });
      writeCache(USERS_CACHE_KEY, mapped);
      setUsers(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const updateRole = async (userId: string, role: UserRole) => {
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(role === 'community_leader' ? { role } : { role, community_id: null })
      .eq('id', userId)
      .select('id');
    if (updateError) return { error: updateError.message };
    // Une mise à jour refusée par les règles d'accès ne renvoie pas d'erreur :
    // sans ce contrôle, l'écran affichait un rôle qui n'avait pas changé.
    if (!updated || updated.length === 0) {
      return { error: "Modification refusée : vous n'avez pas les droits sur ce compte." };
    }

    // Quand un compte quitte le rôle de responsable, on purge toutes ses
    // affectations de communauté. Sans cela, elles resteraient en base et
    // réactiveraient silencieusement ses accès si le rôle lui était réattribué.
    if (role !== 'community_leader') {
      const { error: lcErr } = await supabase.from('leader_communities').delete().eq('leader_id', userId);
      if (lcErr) return { error: `Rôle modifié, mais les affectations n'ont pas pu être retirées : ${lcErr.message}` };
      const { error: cErr } = await supabase.from('communities').update({ leader_id: null }).eq('leader_id', userId);
      if (cErr) return { error: `Rôle modifié, mais la communauté dirigée n'a pas pu être libérée : ${cErr.message}` };
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              role,
              community_id: role === 'community_leader' ? u.community_id : null,
              community_ids: role === 'community_leader' ? u.community_ids : [],
            }
          : u,
      ),
    );
    return { error: null };
  };

  /**
   * Active ou désactive un compte, sans le supprimer ni perdre son historique.
   *
   * Passe par la fonction serveur `manage-user` : en plus de `is_active`, le
   * compte est bloqué côté authentification, ce qui coupe le renouvellement
   * de ses sessions ouvertes. Avant, un compte désactivé restait connecté et
   * gardait l'accès à l'API tant qu'il ne se déconnectait pas.
   */
  const setActive = async (userId: string, active: boolean) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
        body: { action: 'set-active', userId, active },
      });
      const err = (data as { error?: string } | null)?.error;
      if (err) return { error: err };
      if (fnError) return { error: fnError.message };
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: active } : u)),
      );
      return { error: null };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Impossible de mettre à jour ce compte.',
      };
    }
  };

  const createUser = async (name: string, email: string, role: UserRole) => {
    const redirectTo = `${window.location.origin}${__BASE_PATH__}login`;
    const { data, error: fnError } = await supabase.functions.invoke('create-user', {
      body: { name, email, role, redirectTo },
    });
    if (fnError) return { error: fnError.message };
    const err = (data as { error?: string } | null)?.error;
    if (err) return { error: err };
    invalidateCache(USERS_CACHE_KEY);
    await fetchUsers({ force: true });
    return { error: null };
  };

  const updateUser = async (
    userId: string,
    name: string,
    email: string,
    role: UserRole,
    communityIds: string[],
  ) => {
    const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
      body: { action: 'update', userId, name, email, role, communityIds },
    });
    if (fnError) return { error: fnError.message };
    const err = (data as { error?: string } | null)?.error;
    if (err) return { error: err };
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              full_name: name,
              email,
              role,
              community_id: communityIds.length > 0 ? communityIds[0] : null,
              community_ids: communityIds,
            }
          : u,
      ),
    );
    return { error: null };
  };

  const deleteUser = async (userId: string) => {
    const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
      body: { action: 'delete', userId },
    });
    if (fnError) return { error: fnError.message };
    const err = (data as { error?: string } | null)?.error;
    if (err) return { error: err };
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    return { error: null };
  };

  const resetPassword = async (userId: string, password: string) => {
    const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
      body: { action: 'reset-password', userId, mode: 'set', password },
    });
    if (fnError) return { error: fnError.message };
    const err = (data as { error?: string } | null)?.error;
    if (err) return { error: err };
    return { error: null };
  };

  const sendPasswordResetLink = async (userId: string) => {
    const redirectTo = `${window.location.origin}${__BASE_PATH__}login`;
    const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
      body: { action: 'reset-password', userId, mode: 'link', redirectTo },
    });
    if (fnError) return { error: fnError.message };
    const err = (data as { error?: string } | null)?.error;
    if (err) return { error: err };
    return { error: null };
  };

  return {
    users,
    loading,
    error,
    fetchUsers,
    updateRole,
    createUser,
    updateUser,
    deleteUser,
    setActive,
    resetPassword,
    sendPasswordResetLink,
  };
}