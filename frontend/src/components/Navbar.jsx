import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { MetalNavLink } from './ui/metal-nav-link';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import useUnreadMessages from '../hooks/useUnreadMessages';
import '../styles/home-hero.css';

const rhMenuLinkClass = ({ isActive }) => (isActive ? 'is-active' : '');

// Unread-chats count next to a nav label, WhatsApp-style.
function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span
      className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white"
      aria-label={`${count} unread chat${count === 1 ? '' : 's'}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// One nav, every route, and every link wears the same metal ring. Dashboard
// (any logged-in user) and Staff (admins only) are simply left out until
// they apply, at the end of the same row. An earlier attempt kept them
// mounted but invisible and absolutely positioned (for metal-fx's sake) -
// metal-fx's own styles overrode the hiding and they showed over the logo
// for logged-out visitors, so never again: not rendered = not shown.
// Messages, like Dashboard, only shows once you're logged in - for a
// visitor it could only ever bounce them to the login page.
export function navLinks(user, isAdmin, unreadChats) {
  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/why-it-matters', label: 'Why It Matters' },
    { to: '/help', label: 'Help / FAQ' },
  ];
  if (user) links.push({ to: '/messages', label: 'Messages', badge: unreadChats }, { to: '/dashboard', label: 'Dashboard' });
  if (user && isAdmin) links.push({ to: '/admin', label: 'Staff' });
  return links;
}

// Whether the full link row fits. It does at every common desktop size in
// English, but a translated language (longer labels) or a narrow window can
// push it over - then the bar switches to the burger menu (rh-nav--compact)
// rather than letting links run into the logo or the buttons. While
// compact, it tries the full row again once the bar is wider, or the labels
// shorter, than when it last overflowed.
function useRowFits(headerRef, linksRef, linkCount) {
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const overflowedAt = useRef(null);

  useEffect(() => {
    const header = headerRef.current;
    const nav = linksRef.current;
    if (!header || !nav || typeof ResizeObserver === 'undefined') return undefined;

    function set(next) {
      compactRef.current = next;
      setCompact(next);
    }
    function check() {
      if (compactRef.current) {
        const at = overflowedAt.current;
        if (header.clientWidth > at.header + 24 || nav.scrollWidth < at.links - 16) set(false);
      } else if (nav.scrollWidth > nav.clientWidth + 1) {
        overflowedAt.current = { header: header.clientWidth, links: nav.scrollWidth };
        set(true);
      }
    }

    // The metal ring's wrapper settles its size a moment after the label
    // inside it changes, so a change is checked on the next frame and once
    // more shortly after - checking only immediately missed the overflow.
    let frame = 0;
    let timer = 0;
    function schedule() {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = requestAnimationFrame(check);
      timer = setTimeout(check, 250);
    }

    const observer = new ResizeObserver(schedule);
    observer.observe(header);
    // Each pill and its label too, since translation changes a label's
    // width in place.
    for (const el of [...nav.children, ...nav.querySelectorAll('a')]) observer.observe(el);
    check();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [headerRef, linksRef, linkCount]);

  return compact;
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
  const headerRef = useRef(null);
  const linksRef = useRef(null);
  const unreadChats = useUnreadMessages();
  const links = navLinks(user, isAdmin, unreadChats);
  const compact = useRowFits(headerRef, linksRef, links.length);

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
    <header ref={headerRef} className={`rh-nav${compact ? ' rh-nav--compact' : ''}`}>
      <Link to="/" className="rh-logo" translate="no">
        <span className="rh-logo-mark" aria-hidden="true">🛠️</span>
        Rent It
      </Link>

      <nav ref={linksRef} className="rh-nav-links" aria-label="Primary" aria-hidden={compact || undefined}>
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
            <NavBadge count={link.badge} />
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

      <LanguageSwitcher />

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
            <NavBadge count={link.badge} />
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
