import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import ListingDetail from './pages/ListingDetail';
import ListItem from './pages/ListItem';
import EditListing from './pages/EditListing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import About from './pages/About';
import HowItWorks from './pages/HowItWorks';
import WhyItMatters from './pages/WhyItMatters';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Favorites from './pages/Favorites';
import OwnerStorefront from './pages/OwnerStorefront';
import SellerVerification from './pages/SellerVerification';
import AdminDashboard from './pages/AdminDashboard';
import Help from './pages/Help';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { DarkGradientBg } from './components/ui/elegant-dark-pattern';

export default function App() {
  // Nav is fixed/floating so it can sit transparently over Home's video
  // hero - everywhere else needs top padding equal to the nav's height so
  // page content doesn't start underneath it. See .rh-nav-offset.
  const pathname = useLocation().pathname;
  const isHome = pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Navbar />
      <main className={`flex-1 ${isHome ? '' : 'rh-nav-offset'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/owner/:id" element={<OwnerStorefront />} />
          <Route
            path="/list-item"
            element={
              <ProtectedRoute>
                <ListItem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/edit"
            element={
              <ProtectedRoute>
                <EditListing />
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
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/become-seller"
            element={
              <ProtectedRoute>
                <SellerVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/why-it-matters" element={<WhyItMatters />} />
          <Route path="/help" element={<Help />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-night-border/15 bg-night-bg py-6 text-center text-caption text-night-muted">
        <p>© {new Date().getFullYear()} Rent It. Rent smarter, not harder.</p>
        <p className="mt-1 space-x-3">
          <Link to="/terms" className="hover:underline">
            Terms
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)] py-24 text-center">
      <h1 className="text-heading-sm text-night-text">Page not found</h1>
    </DarkGradientBg>
  );
}
