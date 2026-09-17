import { supabase } from './supabaseClient.js';

// Writes one in-app notification row. Never throws into the caller - a
// notification failing to write should never fail the request that
// triggered it (approving a rental still has to succeed even if this
// insert has a hiccup), so errors are logged and swallowed here.
export async function notify({ userId, type, title, body, link }) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, type, title, body, link });
  if (error) console.error('[notify] failed to write notification:', error.message);
}
