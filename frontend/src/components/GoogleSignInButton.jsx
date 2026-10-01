import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { googleEnabled, rememberAfterLogin } from '../lib/googleAuth';

// "Continue with Google" on Log in and Sign up, with an "or" divider under
// it. Renders nothing until Google is switched on in Supabase.
function GoogleG(props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function GoogleSignInButton({ next = '/dashboard', label = 'Continue with Google' }) {
  const { signInWithGoogle } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    googleEnabled().then((on) => alive && setEnabled(on));
    return () => {
      alive = false;
    };
  }, []);

  if (!enabled) return null;

  async function go() {
    setBusy(true);
    setError('');
    rememberAfterLogin(next);
    const { error: oauthError } = await signInWithGoogle();
    // On success the browser is already on its way to Google.
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-btn border border-night-border/25 bg-white py-2.5 text-sm font-semibold text-[#1f1f1f] hover:bg-white/90 disabled:opacity-60"
      >
        <GoogleG className="h-5 w-5" />
        {busy ? 'Opening Google…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-6 flex items-center gap-3 text-xs text-night-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-night-border/15" /> or with email <span className="h-px flex-1 bg-night-border/15" />
      </div>
    </div>
  );
}
