import { supabase } from './supabaseClient.js';

// Records one row per admin action, for the Activity Log tab. Same
// "best effort, never blocks the real action" pattern as notify.js - a
// logging hiccup should never fail the approve/ban/resolve call that
// triggered it.
export async function logAdminAction(adminId, action, targetType, targetId, note = null) {
  const { error } = await supabase
    .from('admin_actions_log')
    .insert({ admin_id: adminId, action, target_type: targetType, target_id: String(targetId), note });
  if (error) console.error('[adminLog] failed to record action', action, error.message);
}
