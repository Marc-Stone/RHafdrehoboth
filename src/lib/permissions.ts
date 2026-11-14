import type { UserRole } from '@/hooks/useAuth';

/**
 * Source unique de vérité des permissions côté interface.
 * Les rôles sont lus depuis Supabase (colonne `profiles.role`) ;
 * ce fichier ne fait que décrire quelles routes sont accessibles à quel rôle.
 * Toute modification de rôle dans Supabase est répercutée automatiquement,
 * car on ne stocke ici aucun utilisateur ni aucune affectation en dur.
 */

export const ALL_ROLES: UserRole[] = [
  'super_admin',
  'pastor',
  'secretary',
  'community_leader',
  'attendance_agent',
];

/**
 * Rôle → liste des routes accessibles.
 * Le super admin a accès à tout (court-circuit dans `canAccessRole`).
 */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['pastor', 'secretary', 'community_leader', 'attendance_agent'],
  '/members': ['super_admin', 'secretary', 'pastor', 'community_leader'],
  '/communities': ['super_admin'],
  '/events': ['super_admin', 'pastor', 'secretary'],
  '/scanner': ['super_admin', 'secretary', 'attendance_agent', 'community_leader'],
  '/attendances': ['super_admin', 'pastor', 'secretary', 'community_leader'],
  '/reports': ['super_admin', 'pastor', 'secretary'],
  '/whatsapp': ['community_leader'],
  '/notifications': ['super_admin', 'pastor', 'secretary', 'community_leader'],
  '/activity': ['super_admin'],
  '/users': ['super_admin'],
  '/settings': ['super_admin'],
  '/account': ['super_admin', 'pastor', 'secretary', 'community_leader', 'attendance_agent'],
};

/**
 * Menu réservé à l'agent de présence : uniquement le pointage et son compte.
 * Ce rôle ne doit jamais voir la gestion, les rapports ni les paramètres.
 */
export const AGENT_ROUTES: string[] = ['/', '/scanner', '/account'];

/**
 * Indique si un rôle peut accéder à une route.
 * Le super admin a toujours accès, quel que soit le tableau fourni.
 */
export function canAccessRole(role: UserRole, allowed: UserRole[]): boolean {
  if (role === 'super_admin') return true;
  return allowed.includes(role);
}

/**
 * Rôles autorisés à consulter et modifier les données médicales sensibles
 * (antécédents médicaux). Ces informations sont en plus protégées côté base
 * par des politiques RLS restreintes sur la table `member_medical`.
 */
export function canAccessMedicalData(role: UserRole): boolean {
  return role === 'super_admin' || role === 'pastor' || role === 'secretary';
}

/**
 * Raccourci pour récupérer les rôles autorisés sur une route.
 */
export function rolesFor(path: string): UserRole[] {
  return ROUTE_ROLES[path] ?? [];
}