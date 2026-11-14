import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/feature/UserAvatar';
import PageHeader from '@/components/base/PageHeader';

export default function AccountPage() {
  const { user, changePassword, removeAvatar } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    const res = await removeAvatar();
    setRemovingAvatar(false);
    if (res.error) {
      setAvatarFeedback({ type: 'error', text: res.error });
      return;
    }
    setAvatarFeedback({ type: 'success', text: 'Photo de profil supprimée.' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (password.length < 8) {
      setFeedback({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    if (password !== confirm) {
      setFeedback({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }
    setSaving(true);
    const res = await changePassword(password);
    setSaving(false);
    if (res.error) {
      setFeedback({ type: 'error', text: res.error });
    } else {
      setFeedback({ type: 'success', text: 'Mot de passe mis à jour avec succès.' });
      setPassword('');
      setConfirm('');
      window.setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Mon espace"
        icon="ri-user-settings-line"
        title="Mon compte"
        description="Consultez vos informations et modifiez votre mot de passe."
      />

      <div className="rounded-lg border border-background-200 bg-background-50 p-5">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar
            initials={user?.initials ?? '?'}
            size="lg"
            editable
            onError={(message) => setAvatarFeedback({ type: 'error', text: message })}
            onChanged={() => setAvatarFeedback({ type: 'success', text: 'Photo de profil mise à jour.' })}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground-900">{user?.name ?? 'Utilisateur'}</p>
            <p className="truncate text-sm text-foreground-500">{user?.email ?? ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-xs text-foreground-400">Cliquez sur la photo pour la changer.</p>
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={removingAvatar}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-accent-700 hover:bg-accent-100/70 disabled:opacity-60"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  {removingAvatar ? 'Suppression...' : 'Supprimer la photo'}
                </button>
              )}
            </div>
          </div>
        </div>

        {avatarFeedback && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              avatarFeedback.type === 'success'
                ? 'border-primary-200 bg-primary-100/70 text-primary-800'
                : 'border-accent-200 bg-accent-100/70 text-accent-800'
            }`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <i className={avatarFeedback.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
            </span>
            <p>{avatarFeedback.text}</p>
          </div>
        )}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-background-100 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">Nom complet</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground-900">{user?.name ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-background-100 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">Rôle</p>
            <span className="mt-1 inline-block rounded-full bg-secondary-100 px-2.5 py-0.5 text-sm font-semibold text-secondary-800">
              {user?.roleLabel ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-background-200 bg-background-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-lock-password-line text-xl"></i>
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground-900">Changer mon mot de passe</h3>
            <p className="text-xs text-foreground-400">Choisissez un mot de passe d'au moins 8 caractères.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-foreground-700">
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-foreground-700">
              Confirmer le mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              feedback.type === 'success'
                ? 'border-primary-200 bg-primary-100/70 text-primary-800'
                : 'border-accent-200 bg-accent-100/70 text-accent-800'
            }`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <i className={feedback.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
            </span>
            <p>{feedback.text}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {saving ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                Mise à jour...
              </>
            ) : (
              <>
                <i className="ri-save-line"></i>
                Mettre à jour
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}