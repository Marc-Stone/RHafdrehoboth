import { useEffect, useState } from 'react';
import type { AdminUser } from '@/hooks/useUsers';
import { inputClass } from '@/components/base/formStyles';
import FormError from '@/components/base/FormError';
import FormField from '@/components/base/FormField';
import Portal from '@/components/base/Portal';

interface PasswordResetModalProps {
  open: boolean;
  user: AdminUser | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSetPassword: (password: string) => void;
  onSendLink: () => void;
}

export default function PasswordResetModal({
  open,
  user,
  submitting,
  error,
  onClose,
  onSetPassword,
  onSendLink,
}: PasswordResetModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirm('');
      setErrors({});
    }
  }, [open, user]);

  if (!open || !user) return null;

  const displayName = user.full_name || user.email || 'cet utilisateur';

  const handleSet = () => {
    const newErrors: Record<string, string> = {};
    if (password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    if (confirm !== password) {
      newErrors.confirm = 'Les mots de passe ne correspondent pas';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSetPassword(password);
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-end p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose}></div>
      <div className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-background-50 shadow-2xl animate-fade-up">
        <div className="flex shrink-0 items-center justify-between border-b border-background-200 px-6 py-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-key-2-line"></i>
            </span>
            Réinitialiser le mot de passe
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-4">
          <p className="text-sm text-foreground-600">
            Compte de <strong className="text-foreground-900">{displayName}</strong>. Choisissez la
            façon de réinitialiser le mot de passe.
          </p>

          <FormError message={error} />

          <FormField label="Nouveau mot de passe" icon="ri-lock-line" error={errors.password}>
            <input
              type="password"
              className={inputClass(!!errors.password)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </FormField>

          <FormField label="Confirmer le mot de passe" icon="ri-lock-password-line" error={errors.confirm}>
            <input
              type="password"
              className={inputClass(!!errors.confirm)}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </FormField>

          <button
            type="button"
            onClick={onSendLink}
            disabled={submitting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100 disabled:opacity-60"
          >
            <i className="ri-mail-send-line"></i>
            Envoyer un lien par e-mail
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-background-200 px-6 py-4">
          <button
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Annuler
          </button>
          <button
            onClick={handleSet}
            disabled={submitting}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                Enregistrement...
              </>
            ) : (
              <>
                <i className="ri-check-line"></i>
                Définir le mot de passe
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}