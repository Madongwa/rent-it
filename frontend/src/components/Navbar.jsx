import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }) =>
  `px-2 py-2 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
    isActive ? 'bg-canvas text-text-primary' : 'text-text-muted hover:text-text-primary'
  }`;

const mobileNavLinkClass = ({ isActive }) =>
  `block rounded-btn px-3 py-2.5 text-body font-medium transition-colors ${
    isActive ? 'bg-canvas text-text-primary' : 'text-text-secondary hover:bg-canvas hover:text-text-primary'
  }`;

function MenuIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    setMobileOpen(false);
    await signOut();
    navigate('/');
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link to="/" className="flex items-center gap-2 text-subheading text-text-primary">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-white">
            🛠️
          </span>
          Rent It
        </Link>

        <div className="hidden xl:flex items-center gap-0.5">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/marketplace" className={navLinkClass}>
            Marketplace
          </NavLink>
          <NavLink to="/how-it-works" className={navLinkClass}>
            How It Works
          </NavLink>
          <NavLink to="/why-it-matters" className={navLinkClass}>
            Why It Matters
          </NavLink>
          <NavLink to="/help" className={navLinkClass}>
            Help / FAQ
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About Us
          </NavLink>
          {user && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/list-item"
            className="shrink-0 whitespace-nowrap rounded-btn bg-text-primary px-5 py-2 text-body font-medium text-white transition-opacity hover:opacity-90"
          >
            + List an Item
          </Link>

          {user ? (
            <button
              onClick={handleSignOut}
              className="hidden shrink-0 whitespace-nowrap rounded-full border border-line px-5 py-2 text-body font-medium text-text-secondary hover:border-text-muted sm:inline-block"
            >
              Log out
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden shrink-0 whitespace-nowrap rounded-full border border-line px-5 py-2 text-body font-medium text-text-secondary hover:border-text-muted sm:inline-block"
            >
              Log in
            </Link>
          )}

          {/* Mobile/tablet nav toggle - the link list above only shows at
              xl (1280px+, where it's guaranteed to fit in one line), so
              this is the only way to reach it under that width. */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-text-secondary hover:border-text-muted xl:hidden"
          >
            {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-line bg-surface px-4 py-3 sm:px-6 xl:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            <NavLink to="/" end className={mobileNavLinkClass} onClick={closeMobileMenu}>
              Home
            </NavLink>
            <NavLink to="/marketplace" className={mobileNavLinkClass} onClick={closeMobileMenu}>
              Marketplace
            </NavLink>
            <NavLink to="/how-it-works" className={mobileNavLinkClass} onClick={closeMobileMenu}>
              How It Works
            </NavLink>
            <NavLink to="/why-it-matters" className={mobileNavLinkClass} onClick={closeMobileMenu}>
              Why It Matters
            </NavLink>
            <NavLink to="/help" className={mobileNavLinkClass} onClick={closeMobileMenu}>
              Help / FAQ
            </NavLink>
            <NavLink to="/about" className={mobileNavLinkClass} onClick={closeMobileMenu}>
              About Us
            </NavLink>
            {user && (
              <NavLink to="/dashboard" className={mobileNavLinkClass} onClick={closeMobileMenu}>
                Dashboard
              </NavLink>
            )}
            {/* Log in/out is hidden below sm in the main bar - surface it here too. */}
            {user ? (
              <button
                onClick={handleSignOut}
                className="mt-1 block rounded-btn px-3 py-2.5 text-left text-body font-medium text-text-secondary hover:bg-canvas hover:text-text-primary sm:hidden"
              >
                Log out
              </button>
            ) : (
              <NavLink
                to="/login"
                className={(props) => `${mobileNavLinkClass(props)} sm:hidden`}
                onClick={closeMobileMenu}
              >
                Log in
              </NavLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
