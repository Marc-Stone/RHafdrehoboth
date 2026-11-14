import { useState } from 'react';
import { useAuth, ROLE_LABELS, USER_ROLES, type UserRole } from '@/hooks/useAuth';
import { useUsers, type AdminUser } from '@/hooks/useUsers';
import { useCommunities } from '@/hooks/useCommunities';
import type { Community } from '@/lib/types';
import UserFormModal from './components/UserFormModal';
import PasswordResetModal from './components/PasswordResetModal';
import PageHeader from '@/components/base/PageHeader';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function leaderCommunityNames(u: AdminUser, communities: Community[]): string[] {
  const ids = u.community_ids.length > 0 ? u.community_ids : u.community_id ? [u.community_id] : [];
  return ids
    .map((cid) => communities.find((c) => c.id === cid)?.name)
    .filter((n): n is string => Boolean(n));
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const {
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
  } = useUsers();
  const { communities } = useCommunities();
  const [updating, setUpdating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('attendance_agent');
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    // Passer un compte en « Responsable de communauté » sans communauté le
    // laissait avec un espace vide (0 membre, WhatsApp et stats vides).
    // On ouvre donc la fiche pour lui affecter au moins une communauté.
    if (role === 'community_leader') {
      const target = users.find((u) => u.id === userId);
      if (target && target.community_ids.length === 0) {
        setEditError(null);
        setEditingUser({ ...target, role: 'community_leader' });
        setFeedback({
          type: 'error',
          text: 'Sélectionnez au moins une communauté pour ce responsable avant d’enregistrer.',
        });
        return;
      }
    }
    setUpdating(userId);
    setFeedback(null);
    const res = await updateRole(userId, role);
    setUpdating(null);
    if (res.error) {
      setFeedback({ type: 'error', text: res.error });
    } else {
      setFeedback({ type: 'success', text: 'Rôle mis à jour.' });
      window.setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newName.trim()) {
      setFeedback({ type: 'error', text: 'Veuillez saisir le nom complet.' });
      return;
    }
    if (!newEmail.trim()) {
      setFeedback({ type: 'error', text: 'Veuillez saisir l\'adresse e-mail.' });
      return;
    }
    setInviting(true);
    const res = await createUser(newName.trim(), newEmail.trim(), newRole);
    setInviting(false);
    if (res.error) {
      setFeedback({ type: 'error', text: res.error });
    } else {
      setFeedback({ type: 'success', text: 'Invitation envoyée par e-mail.' });
      setShowForm(false);
      setNewName('');
      setNewEmail('');
      setNewRole('attendance_agent');
      window.setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleToggleActive = async (target: AdminUser) => {
    const turningOff = target.is_active;
    const label = target.full_name || target.email || 'ce compte';
    if (
      turningOff &&
      !window.confirm(
        `Désactiver le compte de ${label} ? La personne ne pourra plus se connecter jusqu'à réactivation.`,
      )
    ) {
      return;
    }
    setTogglingActive(target.id);
    setFeedback(null);
    const res = await setActive(target.id, !turningOff);
    setTogglingActive(null);
    if (res.error) {
      setFeedback({ type: 'error', text: res.error });
    } else {
      setFeedback({
        type: 'success',
        text: turningOff ? 'Compte désactivé.' : 'Compte activé.',
      });
      window.setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleEditSave = async (name: string, email: string, role: UserRole, communityIds: string[]) => {
    if (!editingUser) return;
    setEditSubmitting(true);
    setEditError(null);
    const res = await updateUser(editingUser.id, name, email, role, communityIds);
    setEditSubmitting(false);
    if (res.error) {
      setEditError(res.error);
    } else {
      setEditingUser(null);
      setFeedback({ type: 'success', text: 'Compte mis à jour.' });
      window.setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    const res = await deleteUser(deletingUser.id);
    setDeleteSubmitting(false);
    if (res.error) {
      setDeleteError(res.error);
    } else {
      setDeletingUser(null);
      setFeedback({ type: 'success', text: 'Compte supprimé.' });
      window.setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSetPassword = async (password: string) => {
    if (!resettingUser) return;
    setResetSubmitting(true);
    setResetError(null);
    const res = await resetPassword(resettingUser.id, password);
    setResetSubmitting(false);
    if (res.error) {
      setResetError(res.error);
    } else {
      setResettingUser(null);
      setFeedback({ type: 'success', text: 'Mot de passe mis à jour.' });
      window.setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSendResetLink = async () => {
    if (!resettingUser) return;
    setResetSubmitting(true);
    setResetError(null);
    const res = await sendPasswordResetLink(resettingUser.id);
    setResetSubmitting(false);
    if (res.error) {
      setResetError(res.error);
    } else {
      setResettingUser(null);
      setFeedback({ type: 'success', text: 'Lien de réinitialisation envoyé par e-mail.' });
      window.setTimeout(() => setFeedback(null), 4000);
    }
  };

  if (currentUser && currentUser.role !== 'super_admin') {
    return (
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          eyebrow="Administration"
          icon="ri-shield-user-line"
          title="Utilisateurs"
          description="Gérez les administrateurs et leurs rôles d'accès."
          tone="secondary"
        />
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center text-sm text-foreground-500">
          Cette section est réservée aux super administrateurs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Administration"
        icon="ri-shield-user-line"
        title="Utilisateurs"
        description="Gérez les administrateurs et leurs rôles d'accès."
        tone="secondary"
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-600">
              <i className="ri-team-line text-sm text-foreground-400"></i>
              {users.length} compte{users.length > 1 ? 's' : ''}
            </span>
            {users.filter((u) => !u.is_active).length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-800">
                <i className="ri-user-unfollow-line text-sm"></i>
                {users.filter((u) => !u.is_active).length} inactif
                {users.filter((u) => !u.is_active).length > 1 ? 's' : ''}
              </span>
            )}
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-user-add-line"></i>
            Ajouter un utilisateur
          </button>
        }
      />

      {feedback && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            feedback.type === 'success'
              ? 'border-primary-200 bg-primary-100 text-primary-800'
              : 'border-background-200 bg-background-100 text-foreground-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <i className="ri-checkbox-circle-line"></i>
            ) : (
              <i className="ri-error-warning-line text-accent-600"></i>
            )}
            <span>{feedback.text}</span>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleInvite}
          className="rounded-lg border border-background-200 bg-background-50 p-5 animate-fade-up"
        >
          <h2 className="font-heading text-base font-semibold text-foreground-900">
            Inviter un nouvel administrateur
          </h2>
          <p className="mt-1 text-sm text-foreground-500">
            La personne recevra un e-mail pour définir son mot de passe.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="invite-name" className="mb-1.5 block text-sm font-medium text-foreground-700">
                Nom complet
              </label>
              <input
                id="invite-name"
                type="text"
                name="full_name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jean Kouassi"
                className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-foreground-700">
                Adresse e-mail
              </label>
              <input
                id="invite-email"
                type="email"
                name="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jean@eglise.org"
                className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium text-foreground-700">
                Rôle
              </label>
              <select
                id="invite-role"
                name="role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full cursor-pointer rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
            >
              {inviting ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Envoi...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line"></i>
                  Envoyer l'invitation
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            <span className="text-sm">Chargement des utilisateurs...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <p className="text-sm text-foreground-600">{error}</p>
            <button
              // Rechargement forcé : passer directement `fetchUsers` lui
              // transmettait l'événement de clic, le cache était donc réutilisé
              // et « Réessayer » ne rechargeait rien.
              onClick={() => void fetchUsers({ force: true })}
              className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              Réessayer
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-foreground-500">
            Aucun utilisateur pour le moment.
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-background-200 text-xs uppercase tracking-wider text-foreground-400">
                  <th className="px-5 py-3 font-semibold">Utilisateur</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Rôle</th>
                  <th className="px-5 py-3 font-semibold">Inscrit le</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const name = u.full_name || u.email?.split('@')[0] || 'Utilisateur';
                  return (
                    <tr key={u.id} className="border-b border-background-100 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-800">
                            {initialsFromName(name)}
                          </div>
                          <div className="leading-tight">
                            <p className="font-medium text-foreground-900">{name}</p>
                            {isSelf && <p className="text-xs text-foreground-400">Vous</p>}
                            {!u.is_active && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-800">
                                <i className="ri-pause-circle-line"></i>
                                Inactif
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground-600">{u.email ?? '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            disabled={isSelf || updating === u.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="cursor-pointer rounded-lg border border-background-200 bg-background-50 px-2.5 py-1.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {USER_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                          {updating === u.id && (
                            <i className="ri-loader-4-line animate-spin text-foreground-400"></i>
                          )}
                        </div>
                        {u.role === 'community_leader' && (
                          <span className="mt-1.5 inline-flex flex-wrap items-center gap-1">
                            {leaderCommunityNames(u, communities).length === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-800">
                                <i className="ri-group-line"></i>
                                Aucune communauté
                              </span>
                            ) : (
                              leaderCommunityNames(u, communities).map((name) => (
                                <span key={name} className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-800">
                                  <i className="ri-group-line"></i>
                                  {name}
                                </span>
                              ))
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground-500">
                        {new Date(u.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSelf || togglingActive === u.id}
                            onClick={() => handleToggleActive(u)}
                            title={
                              isSelf
                                ? 'Impossible de désactiver votre propre compte'
                                : u.is_active
                                  ? 'Désactiver le compte'
                                  : 'Activer le compte'
                            }
                            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              u.is_active
                                ? 'text-foreground-500 hover:bg-accent-100 hover:text-accent-700'
                                : 'text-accent-700 hover:bg-primary-100 hover:text-primary-700'
                            }`}
                          >
                            {togglingActive === u.id ? (
                              <i className="ri-loader-4-line animate-spin"></i>
                            ) : (
                              <i className={u.is_active ? 'ri-user-unfollow-line' : 'ri-user-follow-line'}></i>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditError(null);
                              setEditingUser(u);
                            }}
                            title="Modifier le compte"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-primary-100 hover:text-primary-700"
                          >
                            <i className="ri-edit-line"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetError(null);
                              setResettingUser(u);
                            }}
                            title="Réinitialiser le mot de passe"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-secondary-100 hover:text-secondary-800"
                          >
                            <i className="ri-key-2-line"></i>
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingUser(u);
                            }}
                            title={isSelf ? 'Impossible de supprimer votre propre compte' : 'Supprimer le compte'}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-background-100 md:hidden">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const name = u.full_name || u.email?.split('@')[0] || 'Utilisateur';
              return (
                <div key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-800">
                      {initialsFromName(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground-900">{name}</p>
                        {isSelf && (
                          <span className="rounded-full bg-background-100 px-2 py-0.5 text-[11px] font-medium text-foreground-500">
                            Vous
                          </span>
                        )}
                        {!u.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-800">
                            <i className="ri-pause-circle-line"></i>
                            Inactif
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-foreground-500">{u.email ?? '—'}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={u.role}
                      disabled={isSelf || updating === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="cursor-pointer rounded-lg border border-background-200 bg-background-50 px-2.5 py-1.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    {updating === u.id && (
                      <i className="ri-loader-4-line animate-spin text-foreground-400"></i>
                    )}
                    {u.role === 'community_leader' && (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {leaderCommunityNames(u, communities).length === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-800">
                            <i className="ri-group-line"></i>
                            Aucune communauté
                          </span>
                        ) : (
                          leaderCommunityNames(u, communities).map((name) => (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-800">
                              <i className="ri-group-line"></i>
                              {name}
                            </span>
                          ))
                        )}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-background-100 pt-3">
                    <span className="text-xs text-foreground-500">
                      Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={isSelf || togglingActive === u.id}
                        onClick={() => handleToggleActive(u)}
                        title={
                          isSelf
                            ? 'Impossible de désactiver votre propre compte'
                            : u.is_active
                              ? 'Désactiver le compte'
                              : 'Activer le compte'
                        }
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          u.is_active
                            ? 'text-foreground-500 hover:bg-accent-100 hover:text-accent-700'
                            : 'text-accent-700 hover:bg-primary-100 hover:text-primary-700'
                        }`}
                      >
                        {togglingActive === u.id ? (
                          <i className="ri-loader-4-line animate-spin"></i>
                        ) : (
                          <i className={u.is_active ? 'ri-user-unfollow-line' : 'ri-user-follow-line'}></i>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditError(null);
                          setEditingUser(u);
                        }}
                        title="Modifier le compte"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-primary-100 hover:text-primary-700"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetError(null);
                          setResettingUser(u);
                        }}
                        title="Réinitialiser le mot de passe"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-secondary-100 hover:text-secondary-800"
                      >
                        <i className="ri-key-2-line"></i>
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingUser(u);
                        }}
                        title={isSelf ? 'Impossible de supprimer votre propre compte' : 'Supprimer le compte'}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      <UserFormModal
        open={editingUser !== null}
        editingUser={editingUser}
        isSelf={editingUser?.id === currentUser?.id}
        submitting={editSubmitting}
        error={editError}
        communities={communities}
        onClose={() => setEditingUser(null)}
        onSave={handleEditSave}
      />

      <PasswordResetModal
        open={resettingUser !== null}
        user={resettingUser}
        submitting={resetSubmitting}
        error={resetError}
        onClose={() => setResettingUser(null)}
        onSetPassword={handleSetPassword}
        onSendLink={handleSendResetLink}
      />

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDeletingUser(null)}></div>
          <div className="relative w-full max-w-md rounded-lg bg-background-50 p-6 shadow-2xl animate-fade-up">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <i className="ri-alert-line text-xl"></i>
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-foreground-900">Supprimer ce compte ?</h3>
                <p className="mt-1 text-sm text-foreground-600">
                  Le compte de <strong>{deletingUser.full_name || deletingUser.email || 'cet utilisateur'}</strong> sera définitivement supprimé. Cette action est irréversible.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <i className="ri-error-warning-line"></i>
                  </span>
                  <p>{deleteError}</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={deleteSubmitting}
                className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-accent-700 disabled:opacity-60"
              >
                {deleteSubmitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Suppression...
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line"></i>
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}