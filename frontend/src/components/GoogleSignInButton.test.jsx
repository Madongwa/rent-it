import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { auth, google } = vi.hoisted(() => ({
  auth: { signInWithGoogle: vi.fn(async () => ({ error: null })) },
  google: { enabled: false },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/googleAuth', async (orig) => ({ ...(await orig()), googleEnabled: async () => google.enabled }));

const { default: GoogleSignInButton } = await import('./GoogleSignInButton.jsx');

beforeEach(() => {
  auth.signInWithGoogle.mockClear();
  sessionStorage.clear();
});

describe('GoogleSignInButton', () => {
  it('stays hidden until Google is switched on in Supabase', async () => {
    google.enabled = false;
    const { container } = render(<GoogleSignInButton />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
  });

  it('goes to Google and remembers where to come back to', async () => {
    google.enabled = true;
    render(<GoogleSignInButton next="/listing/abc" />);
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Google/ }));
    expect(auth.signInWithGoogle).toHaveBeenCalled();
    expect(sessionStorage.getItem('rentit.afterLogin')).toBe('/listing/abc');
  });
});
