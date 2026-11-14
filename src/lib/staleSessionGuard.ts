import { supabase } from '@/lib/supabase';
import { clearSupabaseAuthKeys } from '@/lib/safeStorage';

/**
 * Garde-fou global contre les sessions périmées.
 *
 * Le SDK Supabase rafraîchit la session en arrière-plan (minuteur +
 * événements de visibilité). Ce rafraîchissement peut légitimement échouer en
 * fin de vie d'une session : jeton expiré, session révoquée, rotation de jeton
 * effectuée dans un autre onglet, ou simple rechargement de la page pendant un
 * rafraîchissement. Supabase répond alors :
 *   « Invalid Refresh Token: Refresh Token Not Found »
 *
 * Ce n'est PAS un bug de l'application : c'est une fin de session normale. Le
 * problème était qu'un tel rejet remontait comme une erreur non gérée (donc
 * signalée comme plantage) et laissait parfois une session corrompue dans le
 * navigateur, ce qui reproduisait l'erreur à chaque chargement.
 *
 * ⚠️ Ce module doit être importé EN TOUT PREMIER dans `main.tsx`, avant
 * `App` (donc avant l'initialisation des contextes) : les écouteurs doivent
 * exister avant que quoi que ce soit ne puisse rejeter une promesse.
 */

function isStaleSessionError(reason: unknown): boolean {
  const message =
    reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : String(reason);
  return /refresh token/i.test(message) || /session.*(expired|not found)/i.test(message);
}

// Le SDK peut réessayer plusieurs fois avant de renoncer : une seule purge
// suffit pour nettoyer la session locale.
let purging = false;

function purgeStaleSession() {
  if (purging) return;
  purging = true;

  // Nettoyage direct du stockage : on ne s'appuie pas sur `signOut`, car avec
  // un refresh token déjà invalide il peut résoudre sans lever d'erreur tout en
  // laissant la session en place (l'erreur réapparaîtrait au chargement suivant).
  clearSupabaseAuthKeys();

  // Prévenir l'interface pour afficher un message clair (« session expirée »)
  // au lieu de laisser l'utilisateur devant un écran vide ou une erreur brute.
  try {
    window.dispatchEvent(new CustomEvent('app:stale-session'));
  } catch {
    // Environnement sans CustomEvent : le nettoyage reste effectif.
  }

  supabase.auth
    .signOut({ scope: 'local' })
    .catch(() => {
      // Déjà nettoyé ci-dessus : rien de plus à faire.
    })
    .finally(() => {
      setTimeout(() => {
        purging = false;
      }, 1500);
    });
}

// Cas 1 : promesse rejetée (rafraîchissement lancé par le SDK).
window.addEventListener('unhandledrejection', (event) => {
  if (!isStaleSessionError(event.reason)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  purgeStaleSession();
});

// Cas 2 : exception classique remontée dans le contexte courant.
window.addEventListener('error', (event) => {
  if (!isStaleSessionError(event.error ?? event.message)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  purgeStaleSession();
});

export {};