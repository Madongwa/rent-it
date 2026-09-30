import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import TermsGate from './components/TermsGate';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import { DarkGradientBg } from './components/ui/elegant-dark-pattern';
// Every other page is its own download, fetched when first opened, so the
// first visit doesn't load the whole site (staff dashboard, chat, maps...).
const Marketplace = lazy(() => import('./pages/Marketplace'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const ListItem = lazy(() => import('./pages/ListItem'));
const EditListing = lazy(() => import('./pages/EditListing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const WhyItMatters = lazy(() => import('./pages/WhyItMatters'));
const Profile = lazy(() => import('./pages/Profile'));
const Messages = lazy(() => import('./pages/Messages'));
const Favorites = lazy(() => import('./pages/Favorites'));
const OwnerStorefront = lazy(() => import('./pages/OwnerStorefront'));
const SellerVerification = lazy(() => import('./pages/SellerVerification'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Help = lazy(() => import('./pages/Help'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

export default function App() {
  // Nav is fixed/floating so it can sit transparently over Home's video
  // hero - everywhere else needs top padding equal to the nav's height so
  // page content doesn't start underneath it. See .rh-nav-offset.
  const pathname = useLocation().pathname;
  const isHome = pathname === '/';
  // Messages is a full-screen chat app (like WhatsApp Web): the page is
  // exactly one screen tall, the chat panes scroll on their own, and
  // there's no footer underneath.
  const isChat = pathname === '/messages';

  return (
    <div className={isChat ? 'flex h-[100dvh] flex-col overflow-hidden' : 'min-h-screen flex flex-col'}>
      <ScrollToTop />
      <TermsGate />
      <Navbar />
      <main className={`flex-1 ${isHome ? '' : 'rh-nav-offset'} ${isChat ? 'flex min-h-0 flex-col' : ''}`}>
        <Suspense fallback={<PageLoading />}>
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
          {/* The About page was replaced by Messages in the nav - keep old links working. */}
          <Route path="/about" element={<Navigate to="/why-it-matters" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      {!isChat && (
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
      )}
    </div>
  );
}

function PageLoading() {
  return <div className="min-h-[calc(100vh-4rem)] bg-night-bg" aria-busy="true" />;
}

function NotFound() {
  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)] py-24 text-center">
      <h1 className="text-heading-sm text-night-text">Page not found</h1>
    </DarkGradientBg>
  );
}
