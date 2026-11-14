import { supabase } from '@/lib/supabase';

const BUCKET = 'images';
const PRIVATE_BUCKET = 'documents';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Reconnaît les erreurs de droits renvoyées par le stockage.
 * Elles arrivent sous la forme « new row violates row-level security policy »,
 * « Unauthorized », « JWT expired »… et méritent un message compréhensible.
 */
function isPermissionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('row-level security') ||
    m.includes('unauthorized') ||
    m.includes('permission') ||
    m.includes('jwt') ||
    m.includes('not allowed')
  );
}

function friendlyUploadError(message: string): string {
  if (isPermissionError(message)) {
    return "L'envoi du fichier a été refusé par le serveur de stockage. Reconnectez-vous puis réessayez.";
  }
  if (message.toLowerCase().includes('bucket')) {
    return "Le dossier de stockage est introuvable sur le serveur.";
  }
  if (message.toLowerCase().includes('size')) {
    return 'Ce fichier est trop volumineux pour être envoyé.';
  }
  return message;
}

/**
 * Envoi vers un bucket. En cas d'erreur de droits, on tente une fois de
 * rafraîchir la session : un jeton expiré provoque exactement la même erreur
 * RLS qu'un vrai refus, et l'utilisateur n'a alors qu'à réessayer.
 */
async function uploadBlob(bucket: string, path: string, blob: Blob) {
  const options = { upsert: true, contentType: blob.type || 'application/octet-stream' };
  let result = await supabase.storage.from(bucket).upload(path, blob, options);
  if (result.error && isPermissionError(result.error.message)) {
    try {
      await supabase.auth.refreshSession();
    } catch {
      // Si le rafraîchissement échoue, le second essai donnera l'erreur finale.
    }
    result = await supabase.storage.from(bucket).upload(path, blob, options);
  }
  return result;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Envoi d'une image publique (photo de membre, avatar, logo).
 *
 * L'envoi passe TOUJOURS par la fonction serveur `upload-church-image`, qui
 * vérifie le rôle de l'appelant et le dossier visé (avatar : le sien
 * uniquement ; logo : super admin ; membres : rôles de gestion, et pour un
 * responsable uniquement ses communautés).
 *
 * Avant, un refus des règles du bucket déclenchait automatiquement un second
 * envoi via le serveur, qui écrivait avec tous les droits : les règles du
 * stockage ne protégeaient donc plus rien.
 */
export async function uploadChurchImage(path: string, dataUrl: string): Promise<string> {
  const mime = /^data:([^;]+);base64,/.exec(dataUrl)?.[1]?.toLowerCase() ?? '';
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    throw new Error('Format non pris en charge : utilisez une image JPEG, PNG, WebP ou GIF.');
  }

  const { data, error } = await supabase.functions.invoke('upload-church-image', {
    body: { path, dataUrl },
  });

  let serverError = (data as { error?: string } | null)?.error ?? null;
  if (error && !serverError) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        serverError = ((await ctx.json()) as { error?: string }).error ?? null;
      } catch {
        // corps illisible
      }
    }
    serverError ??= friendlyUploadError(error.message);
  }
  if (serverError) throw new Error(serverError);

  const url = (data as { publicUrl?: string } | null)?.publicUrl;
  if (!url) throw new Error("L'envoi de l'image a échoué.");
  return `${url}?v=${Date.now()}`;
}

export async function removeChurchImage(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Upload d'un document sensible (pièce d'identité) dans un bucket privé.
 * Seul le chemin est conservé en base : l'accès se fait via URL signée
 * temporaire, jamais via une URL publique.
 */
export async function uploadPrivateDocument(path: string, dataUrl: string): Promise<string> {
  const { error } = await uploadBlob(PRIVATE_BUCKET, path, dataUrlToBlob(dataUrl));
  if (error) throw new Error(friendlyUploadError(error.message));
  return path;
}

/**
 * Génère une URL signée temporaire (1 heure) pour lire un document privé.
 * Renvoie `null` si le document n'existe pas ou n'est pas accessible.
 */
export async function getPrivateDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function removePrivateDocument(path: string): Promise<void> {
  await supabase.storage.from(PRIVATE_BUCKET).remove([path]);
}