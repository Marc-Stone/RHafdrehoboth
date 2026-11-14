import { supabase } from '@/lib/supabase';

/**
 * Communauté effective d'un événement.
 *
 * Un événement « session » peut ne pas définir sa propre communauté : il hérite
 * alors de celle de son événement parent (conteneur). Sans cette résolution, une
 * session rattachée à un événement restreint à une communauté pourrait accepter
 * des pointages de membres extérieurs (ou, à l'inverse, être traitée comme
 * globale). Cette fonction centralise la règle pour toutes les opérations de
 * pointage.
 */
export async function resolveEventCommunityId(
  communityId: string | null,
  parentEventId: string | null,
): Promise<string | null> {
  if (communityId) return communityId;
  if (!parentEventId) return null;

  const { data: parent } = await supabase
    .from('events')
    .select('community_id, parent_event_id')
    .eq('id', parentEventId)
    .maybeSingle();

  if (parent?.community_id) return parent.community_id;

  // Sécurité : remonte un niveau supplémentaire si le parent est lui-même une session.
  if (parent?.parent_event_id) {
    const { data: grandParent } = await supabase
      .from('events')
      .select('community_id')
      .eq('id', parent.parent_event_id)
      .maybeSingle();
    return grandParent?.community_id ?? null;
  }

  return null;
}