import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { uploadChurchImage, removeChurchImage } from '@/lib/storage';
import { clearSupabaseAuthKeys } from '@/lib/safeStorage';
import { clearCache } from '@/lib/dataCache';

export type UserRole =
  | 'super_admin'
  | 'pastor'
  | 'secretary'
  | 'community_leader'
  | 'attendance_agent';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrateur',
  pastor: 'Pasteur',
  secretary: 'Secrétaire',
  community_leader: 'Responsable de communauté',
  attendance_agent: 'Agent de présence',
};

export const USER_ROLES: UserRole[] = [
  'super_admin',
  'pastor',
  'secretary',
  'community_leader',
  'attendance_agent',
];

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  communityId: string | null;
  communityIds: string[];
}

interface ProfileRow {
  full_name: string | null;
  // `role` vient d'une colonne text libre : on lit le brut puis on valide
  // côté application pour ne jamais accepter une valeur invalide.
  role: string | null;
  email: string | null;
  avatar_url: string | null;
  community_id: string | null;
  /** Compte activé par un administrateur. `false` = connexion refusée. */
  is_active: boolean | null;
}

export interface AuthResult {
  error: string | null;
}

export interface SignUpResult {
  error: string | null;
  sessionCreated: boolean;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  // Erreur explicite lorsque le profil est introuvable/incomplet ou que le rôle
  // est invalide. L'interface ne doit jamais charger une mauvaise vue.
  authError: string | null;
  recoveryMode: boolean;
  setupComplete: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  changePassword: (password: string) => Promise<AuthResult>;
  updateAvatar: (dataUrl: string) => Promise<AuthResult>;
  removeAvatar: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Cache en mémoire des profils VALIDES uniquement (jamais `null`).
// On évite ainsi de re-fetch à chaque rafraîchissement de token, tout en
// garantissant qu'aucune valeur obsolète/invalide ne soit conservée.
const profileCache = new Map<string, ProfileRow>();

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (USER_ROLES as string[]).includes(role);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function toAuthUser(sessionUser: User, profile: ProfileRow, communityIds: string[]): AuthUser {
  const name =
    profile.full_name ||
    (sessionUser.user_metadata?.full_name as string | undefined) ||
    sessionUser.email?.split('@')[0] ||
    'Utilisateur';
  const role = profile.role as UserRole;
  return {
    id: sessionUser.id,
    name,
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    email: sessionUser.email ?? profile.email ?? '',
    initials: initialsFromName(name),
    avatarUrl: profile.avatar_url ?? null,
    communityId: profile.community_id ?? null,
    communityIds,
  };
}

/**
 * Liste complète des communautés d'un utilisateur (responsable multi-communautés).
 * Regroupe la communauté principale (`profiles.community_id`) et les affectations
 * additionnelles (`leader_communities`). Non bloquant : en cas d'erreur, on
 * retombe sur la communauté principale.
 */
async function fetchLeaderCommunityIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('leader_communities')
      .select('community_id')
      .eq('leader_id', userId);
    if (error) return [];
    return ((data ?? []) as { community_id: string }[]).map((r) => r.community_id);
  } catch {
    // jointure inaccessible : on retombe sur la communauté principale.
    return [];
  }
}

/** Fusionne la communauté principale et les affectations additionnelles. */
function mergeCommunityIds(primaryId: string | null, extraIds: string[]): string[] {
  const ids = new Set<string>();
  if (primaryId) ids.add(primaryId);
  extraIds.forEach((id) => ids.add(id));
  return [...ids];
}

function translateError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'Un compte existe déjà avec cet e-mail.';
  }
  const minLength = /at least (\d+) characters/.exec(msg)?.[1];
  if (minLength) {
    return `Le mot de passe doit contenir au moins ${minLength} caractères.`;
  }
  // Correspondances PRÉCISES : avant, toute erreur contenant « email »
  // (non confirmé, limite d'envoi atteinte…) devenait « Adresse e-mail invalide ».
  if (msg.includes('email not confirmed')) {
    return "Votre adresse e-mail n'est pas encore confirmée. Consultez votre boîte de réception.";
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
  }
  if (msg.includes('user is banned') || msg.includes('banned')) {
    return 'Ce compte est désactivé. Contactez un administrateur.';
  }
  if (msg.includes('same password') || msg.includes('should be different')) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (msg.includes('weak password') || msg.includes('password is too weak')) {
    return 'Mot de passe trop faible : choisissez-en un plus long et plus varié.';
  }
  if (
    msg.includes('valid email') ||
    msg.includes('invalid email') ||
    msg.includes('email address is invalid') ||
    msg.includes('unable to validate email')
  ) {
    return 'Adresse e-mail invalide.';
  }
  return message;
}

interface ProfileFetchResult {
  profile: ProfileRow | null;
  error: string | null;
}

async function fetchProfile(user: User): Promise<ProfileFetchResult> {
  // Un profil déjà chargé et valide peut être réutilisé.
  if (profileCache.has(user.id)) {
    return { profile: profileCache.get(user.id) ?? null, error: null };
  }

  const attempt = async (): Promise<ProfileFetchResult> => {
    try {
      // Défense contre un client supabase mal initialisé
      if (!supabase || !supabase.from) {
        return { profile: null, error: 'Client Supabase non initialisé.' };
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, email, avatar_url, community_id, is_active')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        // Erreur réseau/RLS : on ne retombe SURTOUT pas sur un rôle par défaut.
        return { profile: null, error: error.message };
      }
      const profile = (data as ProfileRow) ?? null;
      if (profile) {
        profileCache.set(user.id, profile);
      }
      return { profile, error: null };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // Tracer la cause réelle pour le diagnostic (ne s'affiche pas dans l'UI)
      console.error('[Auth] fetchProfile exception :', e);
      return {
        profile: null,
        error: raw || 'Impossible de charger le profil.',
      };
    }
  };

  const result = await attempt();
  if (!result.error) return result;

  // Trace de diagnostic côté console : permet d'identifier l'erreur réelle
  // (réseau, clé API, RLS...) sans l'exposer dans l'interface.
  console.error('[Auth] Échec du chargement du profil (1re tentative) :', result.error);

  // Une seule relance pour les erreurs réseau transitoires.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const retry = await attempt();
  if (retry.error) {
    console.error('[Auth] Échec du chargement du profil (2e tentative) :', retry.error);
  }
  return retry;
}

function isRefreshTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /refresh token/i.test(message) || /session.*(expired|not found)/i.test(message);
}

async function clearStaleSession() {
  // ⚠️ Piège du SDK : quand le refresh token est déjà invalide, l'appel interne
  // à `_useSession` renvoie une erreur que `signOut({ scope: 'local' })` se
  // contente de propager — il RÉSOUT (ne lève pas) tout en LAISSANT la session
  // en place. L'ancien code ne nettoyait donc jamais le stockage dans ce cas :
  // la session corrompue survivait et l'erreur réapparaissait à chaque
  // rechargement.
  //
  // On ne se repose donc SURTOUT PAS sur le résultat de `signOut` : on purge
  // systématiquement et directement les clés de session du navigateur, puis on
  // demande au SDK de réinitialiser son état mémoire. Scope "local" = aucun
  // appel réseau (le token est de toute façon déjà invalide).
  clearSupabaseAuthKeys();
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Déjà nettoyé ci-dessus : rien de plus à faire.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const recoveryRef = useRef(false);
  // Distingue une déconnexion volontaire (clic utilisateur) d'une déconnexion
  // déclenchée par le SDK (refresh token invalide) afin d'afficher un message
  // clair uniquement dans ce second cas.
  const signingOutRef = useRef(false);

  // Accès synchrone à l'utilisateur courant depuis les écouteurs globaux
  // (sans les recréer à chaque rendu).
  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let active = true;

    const applySession = async (
      sessionUser: User | null,
      options?: { keepOnNetworkError?: boolean },
    ) => {
      if (!sessionUser) {
        if (active) {
          setUser(null);
          setAuthError(null);
        }
        return;
      }

      // Profil et communautés supplémentaires sont chargés EN PARALLÈLE :
      // une seule attente réseau au lieu de deux à la connexion.
      const [{ profile, error }, extraCommunityIds] = await Promise.all([
        fetchProfile(sessionUser),
        fetchLeaderCommunityIds(sessionUser.id),
      ]);
      if (!active) return;

      // Simple rafraîchissement (retour sur l'onglet) en échec réseau : on
      // conserve l'utilisateur déjà chargé. Avant, une coupure passagère
      // renvoyait brutalement vers l'écran de connexion.
      if (error && options?.keepOnNetworkError && userRef.current) {
        return;
      }

      // Erreur de chargement : on refuse de charger une interface incorrecte.
      if (error) {
        setAuthError(
          "Impossible de charger votre profil. Vérifiez votre connexion puis réessayez de vous connecter.",
        );
        setUser(null);
        return;
      }

      // Profil introuvable : erreur explicite, jamais de rôle par défaut.
      if (!profile) {
        setAuthError(
          "Aucun profil n'est associé à ce compte. Contactez un administrateur.",
        );
        setUser(null);
        signingOutRef.current = true;
        await supabase.auth.signOut();
        return;
      }

      // Rôle invalide ou nul : on ne charge aucune interface.
      if (!isValidRole(profile.role)) {
        setAuthError(
          "Le rôle de ce compte est invalide. Contactez un administrateur pour corriger votre profil.",
        );
        setUser(null);
        signingOutRef.current = true;
        await supabase.auth.signOut();
        return;
      }

      // Compte désactivé par un administrateur : connexion refusée avec un
      // message explicite (sinon la personne arrive sur un écran vide).
      if (profile.is_active === false) {
        setAuthError(
          "Votre compte n'est pas encore activé. Contactez un administrateur pour qu'il l'active.",
        );
        setUser(null);
        signingOutRef.current = true;
        await supabase.auth.signOut();
        return;
      }

      setAuthError(null);
      setUser(
        toAuthUser(
          sessionUser,
          profile,
          mergeCommunityIds(profile.community_id ?? null, extraCommunityIds),
        ),
      );
    };

    // Chargement initial : on attend la résolution du profil AVANT de lever
    // `loading`, pour éviter le flash de redirection vers /login.
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) return;
        // `getSession()` RESOUT la promesse (au lieu de la rejeter) quand le
        // refresh token est invalide/expiré : on doit donc inspecter `error`
        // explicitement, sinon la session corrompue n'est jamais purgée et
        // l'utilisateur est redirigé silencieusement sans message clair.
        if (error) {
          // Toute erreur de session (jeton expiré, stockage local corrompu sur
          // certains navigateurs, etc.) est purgée de la même façon pour
          // permettre une reconnexion propre, quel que soit l'appareil.
          await clearStaleSession();
          setAuthError(
            isRefreshTokenError(error)
              ? 'Votre session a expiré. Veuillez vous reconnecter.'
              : "Impossible de charger votre session. Veuillez vous reconnecter.",
          );
          setUser(null);
          setLoading(false);
          return;
        }
        const sessionUser = data?.session?.user ?? null;
        if (recoveryRef.current) {
          setUser(null);
          setRecoveryMode(true);
        } else {
          await applySession(sessionUser);
        }
        if (active) setLoading(false);
      })
      .catch(async (e) => {
        if (!active) return;
        // Refresh token invalide/expiré : on purge la session locale et on
        // affiche un message clair plutôt que de laisser l'erreur en boucle.
        if (isRefreshTokenError(e)) {
          await clearStaleSession();
          setAuthError('Votre session a expiré. Veuillez vous reconnecter.');
        } else {
          // Toute autre erreur (réseau, stockage...) : on ne déconnecte jamais
          // l'utilisateur sans message explicite.
          setAuthError('Impossible de charger votre session. Veuillez vous reconnecter.');
        }
        setUser(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Un refresh de token peut échouer côté SDK sans émettre SIGNED_OUT :
      // on intercepte les erreurs de refresh en amont via un écouteur dédié.
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true;
        setUser(null);
        setRecoveryMode(true);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        // Déconnexion déclenchée par le SDK (refresh token invalide/expiré) :
        // on prévient l'utilisateur. Déconnexion volontaire : pas de message.
        if (!signingOutRef.current) {
          setAuthError('Votre session a expiré. Veuillez vous reconnecter.');
        }
        signingOutRef.current = false;
        setRecoveryMode(false);
        profileCache.clear();
        // Purge du cache de données : aucun compte ne doit hériter des
        // données chargées par la session précédente.
        clearCache();
        return;
      }
      // INITIAL_SESSION est déjà traité par getSession ; TOKEN_REFRESHED ne
      // change pas l'utilisateur. On évite ainsi les requêtes de profil inutiles.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        return;
      }
      const sessionUser = session?.user ?? null;
      // Défense contre une promesse rejetée non gérée (ex. déconnexion en
      // parallèle d'un rechargement de session sur certains navigateurs).
      void applySession(sessionUser).catch((e) => {
        console.error("[Auth] Échec de l'application de session :", e);
      });
    });

    // Le profil (donc le rôle) est mis en cache pour éviter une requête à
    // chaque rafraîchissement de token. Sans invalidation, un changement de
    // rôle effectué par un administrateur sur un autre appareil n'était pris
    // en compte qu'après un rechargement complet de la page. On rafraîchit donc
    // le profil au retour sur l'onglet.
    //
    // ⚠️ Un SEUL écouteur (visibilité de la page) est posé, et il est limité
    // dans le temps : avant, `focus` ET `visibilitychange` se déclenchaient
    // ensemble au retour sur l'onglet, lançaient deux lectures de session
    // simultanées et pouvaient provoquer deux rafraîchissements concurrents du
    // même refresh token. Le second échouait alors avec « Invalid Refresh Token ».
    let lastProfileRefresh = 0;
    const refreshOnFocus = () => {
      if (document.visibilityState === 'hidden') return;
      // Rien à rafraîchir si personne n'est connecté (et on évite ainsi de
      // relancer un rafraîchissement sur une session déjà purgée).
      if (!userRef.current) return;
      const now = Date.now();
      if (now - lastProfileRefresh < 60_000) return;
      lastProfileRefresh = now;
      void supabase.auth
        .getSession()
        .then(async ({ data }) => {
          const sessionUser = data?.session?.user ?? null;
          if (!sessionUser) return;
          // On garde l'ancien profil en mémoire : il sera restauré si la
          // relecture échoue pour une raison réseau.
          const previous = profileCache.get(sessionUser.id);
          profileCache.delete(sessionUser.id);
          await applySession(sessionUser, { keepOnNetworkError: true });
          if (previous && !profileCache.has(sessionUser.id) && userRef.current) {
            profileCache.set(sessionUser.id, previous);
          }
        })
        .catch(() => {
          // Silencieux : le rafraîchissement de rôle ne doit jamais gêner l'usage.
        });
    };
    document.addEventListener('visibilitychange', refreshOnFocus);

    // Une session purgée par le garde-fou global (refresh token invalide) doit
    // être expliquée à l'utilisateur, jamais silencieuse.
    const onStaleSession = () => {
      profileCache.clear();
      setUser(null);
      setAuthError('Votre session a expiré. Veuillez vous reconnecter.');
    };
    window.addEventListener('app:stale-session', onStaleSession);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('app:stale-session', onStaleSession);
    };
  }, []);
  useEffect(() => {
    let active = true;
    // `Promise.resolve` : le constructeur de requête Supabase n'expose pas
    // `.catch` (simple PromiseLike) ; sans cela, une erreur réseau n'était pas
    // interceptée.
    Promise.resolve(supabase.rpc('is_setup_complete'))
      .then(({ data }) => {
        if (active) setSetupComplete(Boolean(data));
      })
      .catch(() => {
        if (active) setSetupComplete(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Déconnexion décidée par l'application (connexion refusée, mot de passe
   * réinitialisé) : marquée comme volontaire pour que l'écouteur SIGNED_OUT
   * n'affiche pas à tort « Votre session a expiré ».
   */
  const quietSignOut = async () => {
    signingOutRef.current = true;
    try {
      await supabase.auth.signOut();
    } catch {
      clearSupabaseAuthKeys();
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    // Nouvelle session = cache vierge (aucune donnée du compte précédent).
    clearCache();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateError(error.message) };

    const sessionUser = data.user ?? data.session?.user ?? null;
    if (!sessionUser) {
      return { error: "Impossible d'établir la session. Réessayez." };
    }

    // On lit le rôle réel depuis Supabase AVANT de définir l'utilisateur :
    // aucune interface ne doit s'afficher avant que le rôle soit connu et valide.
    const [{ profile, error: profileError }, extraCommunityIds] = await Promise.all([
      fetchProfile(sessionUser),
      fetchLeaderCommunityIds(sessionUser.id),
    ]);
    if (profileError) {
      await quietSignOut();
      return { error: "Impossible de charger votre profil. Réessayez." };
    }
    if (!profile) {
      await quietSignOut();
      return {
        error: "Aucun profil n'est associé à ce compte. Contactez un administrateur.",
      };
    }
    if (!isValidRole(profile.role)) {
      await quietSignOut();
      return {
        error: 'Le rôle de ce compte est invalide. Contactez un administrateur.',
      };
    }

    // Compte désactivé : on refuse la connexion AVANT d'afficher l'interface.
    if (profile.is_active === false) {
      await quietSignOut();
      return {
        error:
          "Votre compte n'est pas encore activé. Contactez un administrateur pour qu'il l'active.",
      };
    }

    setAuthError(null);
    setUser(
      toAuthUser(
        sessionUser,
        profile,
        mergeCommunityIds(profile.community_id ?? null, extraCommunityIds),
      ),
    );
    return { error: null };
  };

  const signUp = async (name: string, email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { error: translateError(error.message), sessionCreated: false };
    return { error: null, sessionCreated: Boolean(data.session) };
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    const redirectTo = `${window.location.origin}${__BASE_PATH__}login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: translateError(error.message) };
    return { error: null };
  };

  const updatePassword = async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: translateError(error.message) };
    recoveryRef.current = false;
    setRecoveryMode(false);
    setUser(null);
    profileCache.clear();
    await quietSignOut();
    return { error: null };
  };

  const changePassword = async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: translateError(error.message) };
    return { error: null };
  };

  const updateAvatar = async (dataUrl: string): Promise<AuthResult> => {
    if (!user) return { error: 'Non connecté.' };
    try {
      const url = await uploadChurchImage(`avatars/${user.id}`, dataUrl);
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) return { error: error.message };
      profileCache.delete(user.id);
      setUser((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Impossible d'enregistrer la photo." };
    }
  };

  const removeAvatar = async (): Promise<AuthResult> => {
    if (!user) return { error: 'Non connecté.' };
    try {
      await removeChurchImage(`avatars/${user.id}`);
    } catch {
      // fichier absent, on continue
    }
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    if (error) return { error: error.message };
    profileCache.delete(user.id);
    setUser((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
    return { error: null };
  };

  const signOut = async () => {
    // Déconnexion perçue comme instantanée : on purge l'état local et le cache
    // AVANT d'appeler le serveur, puis on invalide la session. On marque la
    // sortie comme volontaire pour ne pas afficher le message "session expirée".
    signingOutRef.current = true;
    setUser(null);
    setAuthError(null);
    profileCache.clear();
    clearCache();
    try {
      await supabase.auth.signOut();
    } catch {
      // Session déjà invalide : on force un nettoyage direct du stockage pour
      // ne jamais laisser de session corrompue derrière soi.
      clearSupabaseAuthKeys();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        user,
        loading,
        authError,
        recoveryMode,
        setupComplete,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        changePassword,
        updateAvatar,
        removeAvatar,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}