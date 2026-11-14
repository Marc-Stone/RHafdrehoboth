import { useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { readAvatarAsDataUrl } from '@/utils/file';

interface UserAvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  /** Autorise le changement de photo au clic (réservé à « Mon compte »). */
  editable?: boolean;
  /** Remonte les erreurs d'envoi pour éviter un échec silencieux. */
  onError?: (message: string) => void;
  /** Notifie l'écran appelant qu'une photo a bien été enregistrée. */
  onChanged?: () => void;
}

const sizeClasses = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-20 w-20 text-xl',
};

export default function UserAvatar({
  initials,
  size = 'sm',
  editable = false,
  onError,
  onChanged,
}: UserAvatarProps) {
  const { user, updateAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = user?.avatarUrl ?? null;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // On vide tout de suite : permet de re-sélectionner le même fichier après
    // une erreur, et évite de garder une référence au fichier en mémoire.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.("Ce fichier n'est pas une image.");
      return;
    }
    // 5 Mo : au-delà, la conversion en data URL devient lourde et l'envoi
    // échoue souvent sans message côté Storage.
    if (file.size > 5 * 1024 * 1024) {
      onError?.('La photo est trop lourde (5 Mo maximum).');
      return;
    }

    try {
      const dataUrl = await readAvatarAsDataUrl(file);
      const res = await updateAvatar(dataUrl);
      if (res.error) {
        onError?.(res.error);
        return;
      }
      onChanged?.();
    } catch {
      onError?.("Impossible de lire cette image. Essayez une autre photo.");
    }
  };

  const avatarContent = avatarUrl ? (
    <img src={avatarUrl} alt={`Photo de profil de ${user?.name ?? 'utilisateur'}`} className="h-full w-full object-cover" />
  ) : (
    initials
  );

  if (!editable) {
    return (
      <div
        className={`flex ${sizeClasses[size]} shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500 font-bold text-background-50`}
        aria-hidden="true"
      >
        {avatarContent}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative flex cursor-pointer ${sizeClasses[size]} shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500 font-bold text-background-50 ring-secondary-200 transition-shadow hover:ring-2`}
        title="Changer la photo de profil"
      >
        {avatarContent}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <i className="ri-camera-line text-base text-white"></i>
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </>
  );
}