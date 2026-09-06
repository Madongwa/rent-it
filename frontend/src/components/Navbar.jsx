import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'text-brand-600 bg-brand-50' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
  }`;

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-200">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-xl text-stone-900">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
            🛠️
          </span>
          Rent It
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/marketplace" className={navLinkClass}>
            Marketplace
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
            className="rounded-md bg-brand-500 px-3 sm:px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition-colors"
          >
            + List an Item
          </Link>

          {user ? (
            <button
              onClick={handleSignOut}
              className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
            >
              Log out
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
