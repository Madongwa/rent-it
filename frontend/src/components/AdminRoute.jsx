import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// Like ProtectedRoute, but additionally checks profile.role === 'admin'.
// AuthContext only carries the Supabase auth user (no app-level role), so
// this does its own small fetch rather than widening AuthContext for one
// route.
export default function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(null); // null = still checking

  useEffect(() => {
    if (!user) return;
    api
      .getMyProfile()
      .then((profile) => setIsAdmin(profile.role === 'admin'))
      .catch(() => setIsAdmin(false));
  }, [user]);

  if (authLoading || (user && isAdmin === null)) {
    return <div className="flex justify-center bg-black py-24 text-night-muted">Loading…</div>;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
}
