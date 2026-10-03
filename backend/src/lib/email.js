// Email via Resend's plain REST API - no SDK dependency needed, it's one
// POST. Same graceful-degradation pattern as every other optional
// integration in this app (Groq, Digio): if RESEND_API_KEY isn't
// set, sendEmail() just no-ops instead of throwing, so nothing that calls
// it needs its own "is this configured" check.
//
// Resend also requires the FROM domain to be verified (DNS records added
// in their dashboard) before it can send to arbitrary recipients - until
// that's done, Resend only delivers to the email you signed up with. See
// https://resend.com/domains.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Rent It <notifications@renthere.in>';
const SITE_URL = process.env.SITE_URL || 'https://renthere.in';

if (!RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY is missing - emails will be skipped (in-app notifications still work).');
}

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend rejected the send:', res.status, body);
    }
  } catch (err) {
    console.error('[email] failed to send:', err.message);
  }
}

// Titles and bodies carry things people typed (chat messages, names,
// listing titles), so they're always escaped - otherwise a chat message
// could put its own links or markup into an email sent from our domain.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// One plain, brand-light template for every notification email - a
// heading, a body line, and an optional button back into the app. Not
// trying to be fancy; deliverability and "does the link work" matter far
// more than styling for a transactional email like this. Links are always
// a path on our own site.
export function renderNotificationEmail({ title, body, link }) {
  const path = typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '';
  const url = escapeHtml(`${SITE_URL}${path}`);
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#18181b">
      <p style="font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#09090b;margin:0 0 24px">Rent It</p>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 12px;color:#09090b">${escapeHtml(title)}</h1>
      ${body ? `<p style="font-size:15px;line-height:1.5;color:#52525b;margin:0 0 24px">${escapeHtml(body)}</p>` : ''}
      <a href="${url}" style="display:inline-block;background:#09090b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:10px">Open Rent It</a>
      <p style="font-size:12px;color:#a1a1aa;margin:32px 0 0">You're receiving this because you have an account on Rent It.</p>
    </div>
  `;
}
