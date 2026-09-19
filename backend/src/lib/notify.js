import { supabase } from './supabaseClient.js';
import { sendEmail, renderNotificationEmail } from './email.js';

// Writes one in-app notification row, and mirrors it as an email. Neither
// half ever throws into the caller - a notification failing to write (or
// send) should never fail the request that triggered it (approving a
// rental still has to succeed even if this has a hiccup), so errors are
// logged and swallowed here. The email half is also a genuine no-op when
// RESEND_API_KEY isn't set (see email.js), so this function works exactly
// as before for anyone who hasn't configured email yet.
export async function notify({ userId, type, title, body, link }) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, type, title, body, link });
  if (error) console.error('[notify] failed to write notification:', error.message);

  if (!process.env.RESEND_API_KEY) return;
  try {
    const { data, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !data?.user?.email) return;
    await sendEmail({
      to: data.user.email,
      subject: title,
      html: renderNotificationEmail({ title, body, link }),
    });
  } catch (err) {
    console.error('[notify] failed to send email mirror:', err.message);
  }
}
