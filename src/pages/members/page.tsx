import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Member, MemberInput } from '@/lib/types';
import { memberStatusOptions } from '@/lib/constants';
import { useMembers } from '@/hooks/useMembers';
import { useCommunities } from '@/hooks/useCommunities';
import { useAuth } from '@/hooks/useAuth';
import { formatDateShort } from '@/utils/date';
import LazyImage from '@/components/base/LazyImage';
import PageHeader from '@/components/base/PageHeader';
import MemberFormModal from './components/MemberFormModal';

const statusStyle: Record<Member['status'], string> = {
  Actif: 'bg-primary-100 text-primary-700',
  Inactif: 'bg-secondary-100 text-secondary-700',
  Suspendu: 'bg-accent-100 text-accent-700',
};

function initials(member: Member) {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

export default function MembersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members, loading, error, fetchMembers, addMember, updateMember, deleteMember } = useMembers();
  const { communities } = useCommunities();
  const isLeader = user?.role === 'community_leader';
  const [search, setSearch] = useState('');
  // La frappe reste fluide : le filtrage sur toute la liste est différé par
  // React au lieu de bloquer chaque caractère tapé.
  const deferredSearch = useDeferredValue(search);
  const [communityFilter, setCommunityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'),
      ),
    [members],
  );

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return sortedMembers.filter((m) => {
      const matchesSearch =
        !term ||
        m.firstName.toLowerCase().includes(term) ||
        m.lastName.toLowerCase().includes(term) ||
        m.phone.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.neighborhood.toLowerCase().includes(term) ||
        m.community.toLowerCase().includes(term) ||
        m.churchRole.toLowerCase().includes(term) ||
        m.department.toLowerCase().includes(term) ||
        m.number.toLowerCase().includes(term);
      // Un membre peut appartenir à plusieurs communautés : on filtre sur
      // l'ensemble de ses affectations, pas seulement la communauté principale.
      const matchesCommunity =
        !communityFilter ||
        m.communityId === communityFilter ||
        m.communityIds.includes(communityFilter);
      const matchesStatus = !statusFilter || m.status === statusFilter;
      return matchesSearch && matchesCommunity && matchesStatus;
    });
  }, [sortedMembers, deferredSearch, communityFilter, statusFilter]);

  // Pagination : on ne rend qu'une page à la fois. Avec plusieurs milliers de
  // membres, afficher toutes les lignes d'un coup bloquait l'affichage.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paged = useMemo(
    () => filtered.slice(startIndex, startIndex + PAGE_SIZE),
    [filtered, startIndex],
  );

  // Nouveau filtre ou nouvelle recherche : on revient à la première page.
  useEffect(() => {
    setPage(1);
  }, [deferredSearch, communityFilter, statusFilter]);

  const openAdd = () => {
    setEditingMember(null);
    setFormError(null);
    setActionError(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditingMember(member);
    setFormError(null);
    setActionError(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (input: MemberInput) => {
    setSubmitting(true);
    setFormError(null);
    const res = editingMember ? await updateMember(editingMember.id, input) : await addMember(input);
    setSubmitting(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    setModalOpen(false);
    setSuccessMsg(
      editingMember
        ? `Le membre ${input.firstName} ${input.lastName} a été mis à jour.`
        : `Le membre ${input.firstName} ${input.lastName} a été ajouté.`,
    );
    window.setTimeout(() => setSuccessMsg(null), 4000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const target = deleteTarget;
    const res = await deleteMember(target);
    setDeleting(false);
    if (res.error) {
      setActionError(res.error);
      // On garde la confirmation ouverte pour que l'utilisateur puisse réessayer.
      return;
    }
    setDeleteTarget(null);
    setSuccessMsg(`Le membre ${target.firstName} ${target.lastName} a été supprimé.`);
    window.setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Gestion"
        icon="ri-user-star-line"
        title="Membres"
        description="Retrouvez, filtrez et mettez à jour les membres de votre église."
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-600">
            <i className="ri-team-line text-sm text-foreground-400"></i>
            {members.length} membre{members.length > 1 ? 's' : ''} au total
          </span>
        }
        actions={
          !isLeader ? (
            <button
              onClick={openAdd}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-add-line text-base"></i>
              Ajouter un membre
            </button>
          ) : null
        }
      />

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <i className="ri-error-warning-line"></i>
          </span>
          <p>{actionError}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-100/60 p-3 text-sm text-primary-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <i className="ri-checkbox-circle-line"></i>
          </span>
          <p>{successMsg}</p>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, numéro, téléphone, email, quartier, communauté..."
              className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={communityFilter}
              onChange={(e) => setCommunityFilter(e.target.value)}
              className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
            >
              <option value="">Toutes les communautés</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              {memberStatusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            <span className="text-sm">Chargement des membres...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <p className="text-sm text-foreground-600">{error}</p>
            <button
              onClick={fetchMembers}
              className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              Réessayer
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
              <i className="ri-user-add-line text-3xl"></i>
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucun membre pour le moment</h2>
            <p className="mt-2 max-w-sm text-sm text-foreground-500">
              Commencez par ajouter votre premier membre. Son numéro et son QR Code seront générés automatiquement.
            </p>
            {!isLeader && (
              <button
                onClick={openAdd}
                className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
              >
                <i className="ri-add-line"></i>
                Ajouter le premier membre
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-background-200 bg-background-100/70 text-[11px] uppercase tracking-wider text-foreground-500">
                  <th className="px-4 py-3 font-semibold">Membre</th>
                  <th className="px-4 py-3 font-semibold">Numéro</th>
                  <th className="px-4 py-3 font-semibold">Communauté</th>
                  <th className="px-4 py-3 font-semibold">Téléphone</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-100">
                {paged.map((member) => (
                  <tr
                    key={member.id}
                    className="cursor-pointer transition-colors hover:bg-background-100/50"
                    onClick={() => navigate(`/members/${member.number}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <LazyImage
                          src={member.photoUrl}
                          alt={`${member.firstName} ${member.lastName}`}
                          containerClassName="h-9 w-9 shrink-0 rounded-full border border-background-200 bg-background-100"
                          fallback={<span className="text-xs font-bold text-foreground-600">{initials(member)}</span>}
                        />
                        <div>
                          <p className="font-medium text-foreground-900">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-foreground-400">
                            {[member.gender, member.birthDate ? formatDateShort(member.birthDate) : '']
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-600">{member.number}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-700">
                        <span className="max-w-[140px] truncate">{member.community}</span>
                        {member.communityIds.length > 1 && (
                          <span className="rounded-full bg-secondary-100 px-1.5 text-[10px] font-semibold text-secondary-700">
                            +{member.communityIds.length - 1}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-600">{member.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[member.status]}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/members/${member.number}`)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                          title="Voir"
                        >
                          <i className="ri-eye-line"></i>
                        </button>
                        {!isLeader && (
                          <>
                            <button
                              onClick={() => openEdit(member)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                              title="Modifier"
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(member)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-accent-100 hover:text-accent-700"
                              title="Supprimer"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-foreground-400">
                      Aucun membre ne correspond à cette recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            <div className="divide-y divide-background-100 md:hidden">
              {paged.map((member) => (
                <div
                  key={member.id}
                  className="cursor-pointer p-4 transition-colors hover:bg-background-100/50"
                  onClick={() => navigate(`/members/${member.number}`)}
                >
                  <div className="flex items-start gap-3">
                    <LazyImage
                      src={member.photoUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                      containerClassName="h-10 w-10 shrink-0 rounded-full border border-background-200 bg-background-100"
                      fallback={<span className="text-xs font-bold text-foreground-600">{initials(member)}</span>}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-foreground-900">
                          {member.firstName} {member.lastName}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[member.status]}`}>
                          {member.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground-400">
                        {[member.gender, member.birthDate ? formatDateShort(member.birthDate) : '']
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2.5 py-0.5 text-[11px] font-medium text-foreground-700">
                          <span className="max-w-[130px] truncate">{member.community}</span>
                          {member.communityIds.length > 1 && (
                            <span className="rounded-full bg-secondary-100 px-1.5 text-[10px] font-semibold text-secondary-700">
                              +{member.communityIds.length - 1}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[11px] text-foreground-500">{member.number}</span>
                        {member.phone && (
                          <span className="text-[11px] text-foreground-500">{member.phone}</span>
                        )}
                      </div>
                    </div>
                    {!isLeader && (
                      <div className="flex shrink-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(member)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                          title="Modifier"
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(member)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-accent-100 hover:text-accent-700"
                          title="Supprimer"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {paged.length === 0 && (
                <p className="px-4 py-12 text-center text-foreground-400">
                  Aucun membre ne correspond à cette recherche.
                </p>
              )}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-background-200 bg-background-50 px-4 py-3 sm:flex-row">
              <p className="text-xs text-foreground-500">
                {filtered.length === 0
                  ? 'Aucun résultat'
                  : `${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filtered.length)} sur ${filtered.length} membre${filtered.length > 1 ? 's' : ''}`}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-200 text-foreground-600 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Page précédente"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  <span className="px-2 text-xs font-medium text-foreground-700 whitespace-nowrap">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-200 text-foreground-600 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Page suivante"
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <MemberFormModal
        open={modalOpen}
        editingMember={editingMember}
        communities={communities}
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
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground-950">Supprimer ce membre ?</h3>
            <p className="mt-2 text-sm text-foreground-500">
              Vous êtes sur le point de supprimer{' '}
              <strong className="text-foreground-800">{deleteTarget.firstName} {deleteTarget.lastName}</strong>.
              Cette action peut être restaurée ultérieurement (suppression logique).
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