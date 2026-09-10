import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-full text-caption font-medium whitespace-nowrap transition-colors ${
    isActive ? 'bg-canvas text-text-primary' : 'text-text-muted hover:text-text-primary'
  }`;

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
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

        <div className="hidden lg:flex items-center gap-0.5">
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
          <NavLink to="/list-item" className={navLinkClass}>
            List Your Equipment
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
            className="rounded-btn bg-text-primary px-4 py-2 text-body font-medium text-white transition-opacity hover:opacity-90"
          >
            + List an Item
          </Link>

          {user ? (
            <button
              onClick={handleSignOut}
              className="hidden sm:inline-block rounded-full border border-line px-4 py-2 text-body font-medium text-text-secondary hover:border-text-muted"
            >
              Log out
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-block rounded-full border border-line px-4 py-2 text-body font-medium text-text-secondary hover:border-text-muted"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
