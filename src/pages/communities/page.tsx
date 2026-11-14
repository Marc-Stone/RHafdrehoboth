import { useMemo, useState } from 'react';
import { useCommunities, type CommunityInput } from '@/hooks/useCommunities';
import { useMembers } from '@/hooks/useMembers';
import type { Community } from '@/lib/types';
import { communityTypes } from '@/lib/constants';
import CommunityFormModal from './components/CommunityFormModal';
import PageHeader from '@/components/base/PageHeader';
import StatTile from '@/components/base/StatTile';

const typeStyle: Record<string, string> = {
  Ministère: 'bg-primary-100 text-primary-700',
  Groupe: 'bg-secondary-100 text-secondary-700',
  Département: 'bg-accent-100 text-accent-700',
  Cellule: 'bg-background-100 text-foreground-600',
};

export default function CommunitiesPage() {
  const { communities, loading, error, fetchCommunities, addCommunity, updateCommunity, deleteCommunity } = useCommunities();
  const { members } = useMembers();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Community | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Comptage par IDENTIFIANT de communauté (et non par nom de communauté
  // principale) : un membre rattaché à plusieurs communautés est compté dans
  // chacune, et une communauté où il n'est que secondaire n'affiche plus 0.
  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      const ids = m.communityIds.length > 0
        ? m.communityIds
        : m.communityId
          ? [m.communityId]
          : [];
      ids.forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [members]);

  const leaderCount = communities.filter((c) => c.leader).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return communities.filter((c) => {
      const matchesSearch = !term || c.name.toLowerCase().includes(term) || c.leader.toLowerCase().includes(term);
      const matchesType = !typeFilter || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [communities, search, typeFilter]);

  // Membres réellement affectés (au moins une communauté), sans double compte.
  const totalMembersInCommunities = useMemo(
    () => members.filter((m) => m.communityIds.length > 0 || m.communityId).length,
    [members],
  );

  const openAdd = () => {
    setEditingCommunity(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (community: Community) => {
    setEditingCommunity(community);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (input: CommunityInput) => {
    setSubmitting(true);
    setFormError(null);
    const res = editingCommunity ? await updateCommunity(editingCommunity.id, input) : await addCommunity(input);
    setSubmitting(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    setModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const res = await deleteCommunity(deleteTarget);
    setDeleting(false);
    if (res.error) {
      setActionError(res.error);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Organisation"
        icon="ri-group-line"
        title="Communautés"
        description="Gérez les groupes, ministères et départements de l'église."
        tone="secondary"
        actions={
          <button
            onClick={openAdd}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Nouvelle communauté
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Communautés" value={communities.length} icon="ri-group-line" tone="primary" />
        <StatTile
          label="Membres affectés"
          value={totalMembersInCommunities}
          icon="ri-team-line"
          tone="accent"
        />
        <StatTile label="Responsables" value={leaderCount} icon="ri-user-star-line" tone="secondary" />
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <i className="ri-error-warning-line"></i>
          </span>
          <p>{actionError}</p>
        </div>
      )}

      {communities.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une communauté ou un responsable..."
              className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="">Tous les types</option>
            {communityTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 p-12 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Chargement des communautés...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-background-200 bg-background-50 p-12 text-center">
          <p className="text-sm text-foreground-600">{error}</p>
          <button
            onClick={fetchCommunities}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Réessayer
          </button>
        </div>
      ) : communities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
            <i className="ri-group-line text-3xl"></i>
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucune communauté</h2>
          <p className="mt-2 max-w-sm text-sm text-foreground-500">
            Créez votre première communauté (Chorale, Jeunesse, Femmes...) pour organiser vos membres.
          </p>
          <button
            onClick={openAdd}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-add-line"></i>
            Créer une communauté
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((community) => (
            <div
              key={community.id}
              className="group flex flex-col rounded-lg border border-background-200 bg-background-50 p-5 transition-colors hover:border-background-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                    <i className={`${community.icon} text-xl`}></i>
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground-900">{community.name}</h3>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeStyle[community.type] || typeStyle.Groupe}`}>
                      {community.type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(community)}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                    title="Modifier"
                  >
                    <i className="ri-edit-line"></i>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(community)}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-accent-100 hover:text-accent-700"
                    title="Supprimer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-sm text-foreground-500">{community.description || 'Aucune description.'}</p>

              <div className="mt-4 space-y-2 text-sm text-foreground-600">
                <p className="flex items-center gap-2">
                  <i className="ri-user-star-line text-foreground-400"></i>
                  <span className="text-foreground-800">{community.leader}</span>
                </p>
                <p className="flex items-center gap-2">
                  <i className="ri-calendar-line text-foreground-400"></i>
                  {community.meetingDay}
                  {community.meetingTime && ` · ${community.meetingTime}`}
                </p>
                {community.meetingLocation && (
                  <p className="flex items-center gap-2">
                    <i className="ri-map-pin-line text-foreground-400"></i>
                    {community.meetingLocation}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-background-100 pt-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground-500">
                  <i className="ri-team-line"></i>
                  {memberCounts[community.id] || 0} membres
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && communities.length > 0 && (
        <div className="rounded-lg border border-background-200 bg-background-50 py-12 text-center text-foreground-400">
          Aucune communauté ne correspond à cette recherche.
        </div>
      )}

      <CommunityFormModal
        open={modalOpen}
        editingCommunity={editingCommunity}
        submitting={submitting}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDeleteTarget(null)}></div>
          <div className="relative w-full max-w-sm rounded-lg bg-background-50 p-6 shadow-2xl animate-fade-up">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-alert-line text-2xl"></i>
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground-950">Supprimer cette communauté ?</h3>
            <p className="mt-2 text-sm text-foreground-500">
              Vous êtes sur le point de supprimer <strong className="text-foreground-800">{deleteTarget.name}</strong>.
              Les membres affectés ne seront pas supprimés.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-accent-600 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Suppression...
                  </>
                ) : (
                  'Supprimer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}