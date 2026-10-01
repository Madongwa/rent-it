import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { takeAfterLogin } from '../lib/googleAuth';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

// Where Google sends people back to after "Continue with Google". The
// Supabase client reads the login from the address by itself; this page
// waits for it, then goes where they were heading (or the Dashboard).
export default function AuthCallback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const failure = params.get('error_description') || params.get('error');

  useEffect(() => {
    if (user) navigate(takeAfterLogin() || '/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  return (
    <DarkGradientBg className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        {failure || timedOut ? (
          <>
            <h1 className="text-xl font-semibold text-night-text">Google sign-in didn't finish</h1>
            <p className="mt-2 text-sm text-night-muted">{failure ? failure.replace(/\+/g, ' ') : 'It took too long to hear back.'}</p>
            <Link to="/login" className="mt-4 inline-block font-medium text-homeAccent hover:underline">
              Back to log in
            </Link>
          </>
        ) : (
          <p className="text-night-muted" role="status">
            Signing you in…
          </p>
        )}
      </div>
    </DarkGradientBg>
  );
}
