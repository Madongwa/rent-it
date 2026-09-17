import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { MetalNavLink } from './ui/metal-nav-link';
import NotificationBell from './NotificationBell';
import '../styles/home-hero.css';

const rhMenuLinkClass = ({ isActive }) => (isActive ? 'is-active' : '');

// One nav, every route. Extended with Dashboard/Staff via array indices
// (rather than CSS nth-child) since those two entries are conditional -
// nth-child can't reliably target a staggered delay when items in front of
// it come and go.
function useNavLinks(user, isAdmin) {
  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/why-it-matters', label: 'Why It Matters' },
    { to: '/help', label: 'Help / FAQ' },
    { to: '/about', label: 'About Us' },
  ];
  if (user) links.push({ to: '/dashboard', label: 'Dashboard' });
  if (isAdmin) links.push({ to: '/admin', label: 'Staff' });
  return links;
}

function Arrow() {
  return (
    <svg className="rh-arw" viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path d="M0.8 5h10M7.1 1.4 10.9 5l-3.8 3.6" stroke="currentColor"
        strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const burgerRef = useRef(null);
  const menuRef = useRef(null);
  const links = useNavLinks(user, isAdmin);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    api.getMyProfile().then((p) => setIsAdmin(p.role === 'admin')).catch(() => setIsAdmin(false));
  }, [user]);

  // Close on outside click / Escape, with focus returned to the burger.
  useEffect(() => {
    if (!mobileOpen) return;

    function onDocClick(e) {
      if (menuRef.current?.contains(e.target) || burgerRef.current?.contains(e.target)) return;
      setMobileOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        burgerRef.current?.focus();
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  // Reset the mobile panel when the route changes underneath it.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    setMobileOpen(false);
    await signOut();
    navigate('/');
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="rh-nav">
      <Link to="/" className="rh-logo">
        <span className="rh-logo-mark" aria-hidden="true">🛠️</span>
        Rent It
      </Link>

      <nav className="rh-nav-links" aria-label="Primary">
        {links.map((link, i) => (
          <MetalNavLink
            key={link.to}
            to={link.to}
            end={link.end}
            size="sm"
            preset="chromatic"
            style={{ animationDelay: `${(0.54 + i * 0.035).toFixed(3)}s` }}
          >
            {link.label}
          </MetalNavLink>
        ))}
      </nav>

      <div className="rh-nav-actions">
        {user && <NotificationBell />}
        {user ? (
          <button type="button" className="rh-btn rh-btn-login" onClick={handleSignOut}>
            Log out
          </button>
        ) : (
          <Link to="/login" className="rh-btn rh-btn-login">
            Log in
          </Link>
        )}
        <Link to="/list-item" className="rh-btn rh-btn-nav-start">
          + List an Item
          <Arrow />
        </Link>
      </div>

      <button
        ref={burgerRef}
        type="button"
        className="rh-burger"
        onClick={(e) => { e.stopPropagation(); setMobileOpen((o) => !o); }}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        aria-controls="rh-mobile-menu"
      >
        <span></span>
      </button>

      <nav
        id="rh-mobile-menu"
        ref={menuRef}
        className={`rh-menu${mobileOpen ? ' open' : ''}`}
        aria-label="Mobile"
      >
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={rhMenuLinkClass} onClick={closeMobileMenu}>
            {link.label}
          </NavLink>
        ))}
        <div className="rh-divider"></div>
        {user ? (
          <button type="button" className="rh-m-logout" onClick={handleSignOut}>
            Log out
          </button>
        ) : (
          <NavLink to="/login" className={rhMenuLinkClass} onClick={closeMobileMenu}>
            Log in
          </NavLink>
        )}
        <Link to="/list-item" className="rh-m-start" onClick={closeMobileMenu}>
          + List an Item
          <Arrow />
        </Link>
      </nav>
    </header>
  );
}
