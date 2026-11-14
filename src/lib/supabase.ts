import { createClient } from '@supabase/supabase-js';
import { safeAuthStorage } from './safeStorage';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Client Supabase unique de l'application (modèle singleton).
 *
 * ⚠️ On NE définit PAS de verrou (`lock`) personnalisé ici, volontairement.
 *
 * Historiquement un verrou maison était utilisé ici pour éviter qu'un onglet
 * « bloque » le chargement de la session. Mais ce verrou relançait l'opération
 * SANS verrou après un délai, ce qui provoquait deux renouvellements de jeton
 * concurrents. Supabase « fait tourner » le refresh token à chaque
 * renouvellement : le second appel réutilisait alors un jeton déjà consommé et
 * échouait avec « Invalid Refresh Token: Refresh Token Not Found ».
 *
 * Le SDK intègre nativement un verrou multi-onglets robuste (basé sur
 * `navigator.locks`) qui sérialise correctement les renouvellements entre tous
 * les onglets. On s'appuie donc sur ce comportement par défaut, qui est le seul
 * à garantir qu'un seul renouvellement ait lieu à la fois.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Stockage protégé : si le navigateur bloque le stockage local, le SDK
    // bascule sur un repli mémoire au lieu de faire planter l'application.
    storage: safeAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});