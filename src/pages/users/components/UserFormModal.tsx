import { useEffect, useState } from 'react';
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/hooks/useAuth';
import type { AdminUser } from '@/hooks/useUsers';
import type { Community } from '@/lib/types';
import { inputClass } from '@/components/base/formStyles';
import FormError from '@/components/base/FormError';
import FormField from '@/components/base/FormField';
import Portal from '@/components/base/Portal';

interface UserFormModalProps {
  open: boolean;
  editingUser: AdminUser | null;
  isSelf: boolean;
  submitting: boolean;
  error: string | null;
  communities: Community[];
  onClose: () => void;
  onSave: (name: string, email: string, role: UserRole, communityIds: string[]) => void;
}

export default function UserFormModal({
  open,
  editingUser,
  isSelf,
  submitting,
  error,
  communities,
  onClose,
  onSave,
}: UserFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('attendance_agent');
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editingUser) {
      setName(editingUser.full_name ?? '');
      setEmail(editingUser.email ?? '');
      setRole(editingUser.role);
      setCommunityIds(editingUser.community_ids ?? []);
    } else {
      setName('');
      setEmail('');
      setRole('attendance_agent');
      setCommunityIds([]);
    }
    setErrors({});
  }, [open, editingUser]);

  if (!open) return null;

  const isLeader = role === 'community_leader';

  const toggleCommunity = (id: string) => {
    setCommunityIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Le nom complet est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Adresse e-mail invalide';
    }
    if (isLeader && communityIds.length === 0) {
      newErrors.community = 'Sélectionnez au moins une communauté pour ce responsable';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSave(name.trim(), email.trim(), role, isLeader ? communityIds : []);
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-end p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose}></div>
      <div className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-background-50 shadow-2xl animate-fade-up">
        <div className="flex shrink-0 items-center justify-between border-b border-background-200 px-6 py-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-user-settings-line"></i>
            </span>
            Modifier le compte
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-4">
          <FormError message={error} />

          <FormField label="Nom complet" icon="ri-user-line" error={errors.name}>
            <input
              className={inputClass(!!errors.name)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jean Kouassi"
            />
          </FormField>

          <FormField label="Adresse e-mail" icon="ri-mail-line" error={errors.email}>
            <input
              type="email"
              className={inputClass(!!errors.email)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@eglise.org"
            />
          </FormField>

          <FormField label="Rôle" icon="ri-shield-user-line" hint={isSelf ? 'Vous ne pouvez pas modifier votre propre rôle.' : undefined}>
            <select
              className={inputClass(false)}
              value={role}
              disabled={isSelf}
              onChange={(e) => {
                setRole(e.target.value as UserRole);
                if (e.target.value !== 'community_leader') setCommunityIds([]);
              }}
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </FormField>

          {isLeader && (
            <FormField
              label="Communautés affectées"
              icon="ri-group-line"
              error={errors.community}
              hint="Ce responsable accèdera aux données de toutes les communautés cochées."
            >
              <div className="rounded-lg border border-background-200 bg-background-50 p-2">
                {communities.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-foreground-400">
                    Aucune communauté disponible. Créez d'abord des communautés.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {communities.map((c) => {
                      const checked = communityIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
                            checked ? 'bg-primary-100/60 text-foreground-900' : 'text-foreground-700 hover:bg-background-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCommunity(c.id)}
                            className="h-4 w-4 cursor-pointer rounded border-background-300 text-primary-500 focus:ring-primary-400"
                          />
                          <span className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background-100 text-foreground-500">
                              <i className={c.icon || 'ri-group-line'}></i>
                            </span>
                            {c.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-foreground-400">
                {communityIds.length} communauté{communityIds.length > 1 ? 's' : ''} sélectionnée{communityIds.length > 1 ? 's' : ''}
              </p>
            </FormField>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-background-200 px-6 py-4">
          <button
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
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
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}