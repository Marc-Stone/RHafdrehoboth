import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/currentUser';
import { ROLE_LABELS } from '@/hooks/useAuth';

export async function logActivity(action: string, details: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', userId)
      .maybeSingle();
    const role = (profile?.role ?? '') as keyof typeof ROLE_LABELS;
    await supabase.from('activity_logs').insert({
      user_id: userId,
      user_name: profile?.full_name ?? 'Utilisateur',
      role_label: ROLE_LABELS[role] ?? 'Utilisateur',
      action,
      details,
    });
  } catch {
    // logging must never break the main flow
  }
}