import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notify, shouldEmail } from './notify.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// Stand-in for the profile lookup, the unread-chat count and the auth user.
function fakeDb({ emailsOn = true, unreadInChat = 1 } = {}) {
  const inserted = [];
  return {
    inserted,
    from(table) {
      const q = {
        insert: async (row) => (inserted.push(row), { error: null }),
        select: () => q,
        eq: () => q,
        gte: () => q,
        maybeSingle: async () => ({ data: table === 'profiles' ? { email_notifications: emailsOn } : null }),
        then: (resolve) => resolve({ count: unreadInChat, error: null }),
      };
      return q;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'asha@example.com' } } }) } },
  };
}

describe('shouldEmail', () => {
  it('emails other notifications when emails are on', async () => {
    expect(await shouldEmail({ userId: 'u', type: 'rental_approved' }, { db: fakeDb() })).toBe(true);
  });

  it('never emails someone who turned emails off', async () => {
    expect(await shouldEmail({ userId: 'u', type: 'rental_approved' }, { db: fakeDb({ emailsOn: false }) })).toBe(false);
  });

  it('emails only the first unread message in a chat', async () => {
    expect(await shouldEmail({ userId: 'u', type: 'new_message', link: '/messages?c=1' }, { db: fakeDb({ unreadInChat: 1 }) })).toBe(true);
    expect(await shouldEmail({ userId: 'u', type: 'new_message', link: '/messages?c=1' }, { db: fakeDb({ unreadInChat: 2 }) })).toBe(false);
  });
});

describe('notify', () => {
  beforeEach(() => vi.stubEnv('RESEND_API_KEY', 'test'));
  afterEach(() => vi.unstubAllEnvs());

  it('always writes the in-app notification, and emails when allowed', async () => {
    const send = vi.fn();
    const db = fakeDb();
    await notify({ userId: 'u', type: 'rental_approved', title: 'Deal agreed', body: 'b', link: '/x' }, { db, send });
    expect(db.inserted).toHaveLength(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'asha@example.com', subject: 'Deal agreed' }));

    const quiet = fakeDb({ emailsOn: false });
    send.mockReset();
    await notify({ userId: 'u', type: 'rental_approved', title: 't', body: 'b', link: '/x' }, { db: quiet, send });
    expect(quiet.inserted).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });
});
