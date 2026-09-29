import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, NavLink } from 'react-router-dom';

const { auth, api } = vi.hoisted(() => ({ auth: { user: null }, api: { getMyProfile: vi.fn() } }));

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, signOut: vi.fn() }) }));
vi.mock('../lib/api', () => ({ api }));
vi.mock('../hooks/useUnreadMessages', () => ({ default: () => 0 }));
vi.mock('./NotificationBell', () => ({ default: () => <button type="button" aria-label="Notifications" /> }));
vi.mock('./LanguageSwitcher', () => ({ default: () => null }));
// The metal ring is WebGL - a plain NavLink stands in for it here.
vi.mock('./ui/metal-nav-link', () => ({
  MetalNavLink: ({ to, end, children }) => (
    <NavLink to={to} end={end}>
      {children}
    </NavLink>
  ),
}));

const { default: Navbar } = await import('./Navbar.jsx');

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
}

const primaryLinks = () => within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link').map((a) => a.textContent);
const PUBLIC = ['Home', 'Marketplace', 'How It Works', 'Why It Matters', 'Help / FAQ', 'Messages'];

beforeEach(() => {
  auth.user = null;
  api.getMyProfile.mockReset();
});

describe('Navbar - which links show', () => {
  it('logged out: no Dashboard or Staff anywhere, and "Log in"', () => {
    renderNavbar();
    expect(primaryLinks()).toEqual(PUBLIC);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff')).not.toBeInTheDocument();
    expect(screen.getAllByText('Log in').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument();
  });

  it('regular user: Dashboard at the end of the same row, no Staff', async () => {
    auth.user = { id: 'u1' };
    api.getMyProfile.mockResolvedValue({ role: 'user' });
    renderNavbar();
    await waitFor(() => expect(api.getMyProfile).toHaveBeenCalled());
    expect(primaryLinks()).toEqual([...PUBLIC, 'Dashboard']);
    expect(screen.queryByText('Staff')).not.toBeInTheDocument();
  });

  it('admin: Dashboard then Staff at the end of the same row', async () => {
    auth.user = { id: 'a1' };
    api.getMyProfile.mockResolvedValue({ role: 'admin' });
    renderNavbar();
    await waitFor(() => expect(primaryLinks()).toEqual([...PUBLIC, 'Dashboard', 'Staff']));
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('never shows Staff if the profile check fails', async () => {
    auth.user = { id: 'u1' };
    api.getMyProfile.mockImplementation(() => Promise.reject(new Error('offline')));
    renderNavbar();
    await waitFor(() => expect(api.getMyProfile).toHaveBeenCalled());
    expect(primaryLinks()).toEqual([...PUBLIC, 'Dashboard']);
  });
});
