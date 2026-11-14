import { useRef, useState } from 'react';
import { readAvatarAsDataUrl, readFileAsDataUrl } from '@/utils/file';

interface FileUploadFieldProps {
  label: string;
  icon: string;
  hint?: string;
  mode: 'avatar' | 'document';
  preview: string | null;
  onFile: (dataUrl: string) => void;
  onRemove: () => void;
  required?: boolean;
}

export default function FileUploadField({
  label,
  icon,
  hint,
  mode,
  preview,
  onFile,
  onRemove,
  required,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState('');

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setReadError('');
    try {
      const dataUrl =
        mode === 'avatar' ? await readAvatarAsDataUrl(file, 512) : await readFileAsDataUrl(file, 1600);
      onFile(dataUrl);
    } catch {
      setReadError('Impossible de lire ce fichier. Réessayez avec une image valide.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground-700">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-foreground-400">
          <i className={icon}></i>
        </span>
        <span>
          {label}
          {required && <span className="text-accent-500"> *</span>}
        </span>
      </label>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      {preview ? (
        <div className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 p-3">
          {mode === 'avatar' ? (
            <img
              src={preview}
              alt={label}
              className="h-16 w-16 shrink-0 rounded-full border border-background-200 object-cover"
            />
          ) : (
            <img
              src={preview}
              alt={label}
              className="h-16 w-20 shrink-0 rounded-md border border-background-200 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-foreground-500">Aperçu du fichier</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-200 px-2.5 py-1 text-xs font-medium text-foreground-700 hover:bg-background-100 disabled:opacity-60"
              >
                <i className="ri-refresh-line"></i>
                Remplacer
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-accent-200 px-2.5 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100/60"
              >
                <i className="ri-delete-bin-line"></i>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-4 py-5 text-foreground-500 transition-colors hover:border-primary-400 hover:text-primary-600 disabled:opacity-60"
        >
          {busy ? (
            <i className="ri-loader-4-line animate-spin text-lg"></i>
          ) : (
            <i className={`${icon} text-xl`}></i>
          )}
          <span className="whitespace-nowrap text-xs font-medium">Importer</span>
        </button>
      )}

      {hint && !preview && <p className="mt-1 text-xs text-foreground-400">{hint}</p>}
      {readError && (
        <p className="mt-1 flex items-center gap-1 text-xs text-accent-600">
          <i className="ri-error-warning-line"></i>
          {readError}
        </p>
      )}
    </div>
  );
}