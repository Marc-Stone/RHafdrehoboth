/**
 * Accès sécurisé au stockage local du navigateur.
 *
 * Sur certaines machines (stockage/cookies bloqués, navigation privée,
 * navigateur d'entreprise, réglages de confidentialité stricts...), le simple
 * fait de LIRE `window.localStorage` lève une exception de sécurité. Comme ce
 * stockage est utilisé au tout début du démarrage (thème, session), une telle
 * exception faisait planter l'intégralité du rendu et laissait un écran
 * entièrement blanc — et uniquement sur les machines concernées.
 *
 * Ce module isole TOUS les accès au stockage derrière un try/catch, avec un
 * repli en mémoire : l'application démarre toujours, même quand le stockage
 * local est indisponible.
 */

const memoryStore = new Map<string, string>();

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    // L'accès à la propriété `window.localStorage` lui-même peut lever une
    // SecurityError sur certains navigateurs : on l'entoure donc aussi.
    const storage = window.localStorage;
    if (!storage) return null;
    // Test d'écriture réel : certains navigateurs ne lèvent l'erreur qu'ici.
    const probe = '__readdy_storage_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function safeGetItem(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return memoryStore.get(key) ?? null;
  try {
    return storage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

export function safeSetItem(key: string, value: string): void {
  memoryStore.set(key, value);
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Stockage indisponible : la valeur reste disponible via le repli mémoire.
  }
}

export function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Rien de plus à faire.
  }
}

/**
 * Adaptateur de stockage compatible avec le SDK Supabase. Le SDK y accède dès
 * le démarrage pour restaurer la session : sans protection, un stockage bloqué
 * ferait échouer l'initialisation de l'application.
 */
export const safeAuthStorage = {
  getItem: (key: string): string | null => safeGetItem(key),
  setItem: (key: string, value: string): void => safeSetItem(key, value),
  removeItem: (key: string): void => safeRemoveItem(key),
};

/**
 * Supprime directement toutes les clés de session Supabase (`sb-*-auth-token`)
 * du stockage local et du repli mémoire, sans passer par le SDK.
 *
 * Cas d'usage : quand le refresh token est déjà invalide ou expiré, l'appel
 * `supabase.auth.signOut({ scope: 'local' })` peut échouer avant d'avoir purgé
 * la session — le SDK tente d'abord de se réinitialiser, ce qui relance la même
 * erreur. Résultat : la session corrompue reste en place et l'erreur
 * « Invalid Refresh Token: Refresh Token Not Found » réapparaît à chaque
 * chargement. Ce nettoyage direct contourne le SDK pour garantir une
 * reconnexion propre.
 */
export function clearSupabaseAuthKeys(): void {
  const storage = getLocalStorage();
  if (storage) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('sb-') && key.includes('auth-token')) {
          keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Stockage indisponible : le repli mémoire est nettoyé ci-dessous.
    }
  }
  memoryStore.forEach((_, key) => {
    if (key.startsWith('sb-') && key.includes('auth-token')) {
      memoryStore.delete(key);
    }
  });
}