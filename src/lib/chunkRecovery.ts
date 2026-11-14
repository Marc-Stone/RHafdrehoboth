import { lazy, type ComponentType } from 'react';

/**
 * Récupération après une mise à jour du site.
 *
 * Chaque déploiement produit de nouveaux fichiers (`/assets/xxx-HASH.js`) et
 * supprime les anciens. Un onglet ouvert AVANT le déploiement réclame encore
 * les anciens fichiers en changeant de page : le chargement échoue et
 * l'application affichait « Un problème est survenu ».
 *
 * Avant, le rechargement automatique n'avait lieu qu'UNE fois par session
 * (au 2ᵉ déploiement, l'écran d'erreur restait), et l'échec de chargement
 * d'un fichier CSS n'était pas reconnu du tout.
 *
 * Désormais : toute erreur de ce type déclenche un rechargement, protégé
 * contre les boucles par un délai minimal entre deux rechargements.
 */

const RELOAD_KEY = 'app:version-reload-at';
const MIN_INTERVAL_MS = 15_000;

const CHUNK_ERROR_PATTERN =
  /dynamically imported module|module script failed|importing a module script|error loading dynamically|ChunkLoadError|Loading chunk|Loading CSS chunk|Unable to preload CSS|Failed to fetch dynamically|'text\/html' is not a valid JavaScript MIME type/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : String((error as { message?: unknown }).message ?? '');
  return CHUNK_ERROR_PATTERN.test(message);
}

function readLastReload(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * Recharge la page pour récupérer la nouvelle version du site.
 * Renvoie `false` si un rechargement vient déjà d'avoir lieu (évite une
 * boucle infinie si le problème ne vient pas d'une mise à jour).
 */
export function reloadForNewVersion(): boolean {
  const now = Date.now();
  if (now - readLastReload() < MIN_INTERVAL_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Stockage indisponible : on recharge quand même (une boucle reste
    // improbable, le navigateur récupère alors la nouvelle version).
  }
  window.location.reload();
  return true;
}

/**
 * `lazy()` avec récupération : si le fichier de la page n'existe plus (site
 * mis à jour), on recharge la page au lieu d'afficher une erreur. Pendant le
 * rechargement, la promesse reste en attente : l'utilisateur voit simplement
 * le chargement de la page.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (isChunkLoadError(error) && reloadForNewVersion()) {
        return new Promise<{ default: T }>(() => {
          // Rechargement en cours : on n'affiche rien d'autre.
        });
      }
      throw error;
    }
  });
}

let installed = false;

/**
 * Écouteurs globaux, à installer une seule fois au démarrage :
 * - `vite:preloadError` : échec de préchargement d'un fichier JS/CSS ;
 * - promesse rejetée non gérée due à un fichier manquant.
 */
export function installChunkRecovery(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason) && reloadForNewVersion()) {
      event.preventDefault();
    }
  });
}
