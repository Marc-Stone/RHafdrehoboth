/**
 * Cache mémoire partagé (léger, sans dépendance).
 *
 * Objectif : éviter de rejouer exactement les mêmes requêtes Supabase à chaque
 * montage de composant / navigation entre pages, tout en restant TOUJOURS
 * correct côté données.
 *
 * Principes :
 * - `readCache` ne renvoie une valeur que si elle est plus récente que le TTL.
 * - Toute mutation métier invalide explicitement sa clé (voir les hooks).
 * - `dedupe` mutualise les requêtes simultanées : quand deux composants
 *   demandent la même liste au même moment, une seule requête réseau part.
 *
 * Le cache vit uniquement en mémoire : rien n'est persisté sur le disque, donc
 * aucune donnée périmée ne survit à un rechargement de la page.
 */
export interface CacheEntry<T> {
  data: T;
  at: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/** Durée de fraîcheur par défaut : 30 secondes. */
export const DEFAULT_CACHE_TTL = 30_000;

/**
 * Lit une valeur encore fraîche. Renvoie `null` si absente ou trop ancienne.
 */
export function readCache<T>(key: string, maxAgeMs: number = DEFAULT_CACHE_TTL): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.at > maxAgeMs) return null;
  return entry.data;
}

/** Enregistre une valeur fraîche à l'instant présent. */
export function writeCache<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

/** Invalide une ou plusieurs clés (à appeler après chaque mutation). */
export function invalidateCache(...keys: string[]): void {
  keys.forEach((key) => store.delete(key));
}

/** Invalide toutes les clés commençant par un préfixe donné. */
export function invalidateCachePrefix(prefix: string): void {
  Array.from(store.keys()).forEach((key) => {
    if (key.startsWith(prefix)) store.delete(key);
  });
}

/**
 * Vide entièrement le cache. À appeler impérativement à la déconnexion :
 * les données sont filtrées par les règles d'accès Supabase selon le compte
 * connecté, un cache conservé d'une session à l'autre exposerait les données
 * du compte précédent.
 */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}

/**
 * Mutualise les requêtes simultanées partageant la même clé.
 * La promesse est retirée du registre dès qu'elle est résolue.
 */
export function dedupe<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = loader().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}