import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activity';

interface RequireRoleProps {
  allowed: UserRole[];
  children: ReactNode;
}

/**
 * Garde de route : n'affiche le contenu que si le rôle réel de l'utilisateur
 * (récupéré depuis Supabase) est autorisé. Sinon redirige vers /403 et trace
 * la tentative d'accès dans le journal des activités.
 */
export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const { user } = useAuth();

  const unauthorized = Boolean(
    user && user.role !== 'super_admin' && !allowed.includes(user.role),
  );

  useEffect(() => {
    if (unauthorized) {
      void logActivity('refus', "a tenté d'accéder à une page non autorisée");
    }
  }, [unauthorized]);

  if (!user) {
    // Jamais d'écran vide : sans utilisateur chargé, on renvoie proprement
    // vers la connexion au lieu de retourner `null` (zone blanche).
    return <Navigate to="/login" replace />;
  }

  if (unauthorized) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}