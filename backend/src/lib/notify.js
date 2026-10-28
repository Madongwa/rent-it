import { supabase } from './supabaseClient.js';
import { sendEmail, renderNotificationEmail } from './email.js';

// Writes one in-app notification row, and mirrors it as an email. Neither
// half ever throws into the caller - a notification failing to write (or
// send) should never fail the request that triggered it (approving a
// rental still has to succeed even if this has a hiccup), so errors are
// logged and swallowed here. The email half is also a genuine no-op when
// RESEND_API_KEY isn't set (see email.js), so this function works exactly
// as before for anyone who hasn't configured email yet.

// A busy chat would otherwise send an email per message: only the first
// unread message in a chat is emailed, until it's read (or this long passes).
export const CHAT_EMAIL_QUIET_HOURS = 6;

// Should this notification also go out by email? Not if the person turned
// emails off (Profile page), and not for a chat that already has an unread
// message notification (the one just written counts as one).
export async function shouldEmail({ userId, type, link }, { db = supabase, now = Date.now() } = {}) {
  const { data: profile } = await db.from('profiles').select('email_notifications').eq('id', userId).maybeSingle();
  if (profile?.email_notifications === false) return false;
  if (type !== 'new_message') return true;
  const since = new Date(now - CHAT_EMAIL_QUIET_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'new_message')
    .eq('link', link)
    .eq('read', false)
    .gte('created_at', since);
  if (error) return true;
  return (count || 0) <= 1;
}

export async function notify({ userId, type, title, body, link }, { db = supabase, send = sendEmail } = {}) {
  const { error } = await db.from('notifications').insert({ user_id: userId, type, title, body, link });
  if (error) console.error('[notify] failed to write notification:', error.message);

  if (!process.env.RESEND_API_KEY) return;
  try {
    if (!(await shouldEmail({ userId, type, link }, { db }))) return;
    const { data, error: userError } = await db.auth.admin.getUserById(userId);
    if (userError || !data?.user?.email) return;
    await send({
      to: data.user.email,
      subject: title,
      html: renderNotificationEmail({ title, body, link }),
    });
  } catch (err) {
    console.error('[notify] failed to send email mirror:', err.message);
  }
}
