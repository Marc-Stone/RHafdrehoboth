import { supabase } from '@/lib/supabase';

/**
 * Identifiant de l'utilisateur connecté, lu depuis la session locale.
 *
 * Pourquoi ne PAS utiliser `supabase.auth.getUser()` ici :
 * `getUser()` est un appel RÉSEAU qui, lorsque le jeton d'accès est expiré,
 * déclenche un rafraîchissement de session. Si le refresh token a déjà été
 * consommé (rotation effectuée dans un autre onglet, session révoquée, ou
 * rechargement pendant un rafraîchissement), cet appel REJETTE avec
 * « Invalid Refresh Token: Refresh Token Not Found ».
 *
 * Ces appels étaient faits sans protection dans plusieurs écrans : la promesse
 * rejetée remontait alors comme une erreur non gérée et cassait le pointage ou
 * la clôture d'événement.
 *
 * `getSession()` lit la session déjà en mémoire/stockage et ne fait donc aucun
 * appel réseau dans le cas normal. Tout échec (session absente, stockage
 * bloqué, jeton invalide) est absorbé : on renvoie simplement `null` et
 * l'action appelante continue sans identifiant, au lieu de planter.
 *
 * La sécurité n'est pas affaiblie : c'est Supabase (RLS + `auth.uid()`) qui
 * reste seul juge des droits d'écriture côté serveur.
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}