import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import ListingDetail from './pages/ListingDetail';
import ListItem from './pages/ListItem';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ComingSoon from './pages/ComingSoon';
import HowItWorks from './pages/HowItWorks';

export default function App() {
  // Home, Login, Signup, Marketplace, and How It Works use the dark
  // editorial theme; the footer needs to match it there instead of the
  // site's default light theme.
  const pathname = useLocation().pathname;
  const isDarkPage =
    pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/marketplace' || pathname === '/how-it-works';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route
            path="/list-item"
            element={
              <ProtectedRoute>
                <ListItem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/why-it-matters" element={<ComingSoon title="Why It Matters" />} />
          <Route path="/help" element={<ComingSoon title="Help / FAQ" />} />
          <Route path="/about" element={<ComingSoon title="About Us" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer
        className={`border-t py-6 text-center text-caption ${
          isDarkPage ? 'border-night-border/15 bg-night-bg text-night-muted' : 'border-line text-text-muted'
        }`}
      >
        © {new Date().getFullYear()} Rent It. Rent smarter, not harder.
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-heading-sm text-text-primary">Page not found</h1>
    </div>
  );
}
