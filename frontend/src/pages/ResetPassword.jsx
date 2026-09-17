import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const MIN_PASSWORD_LENGTH = 6;

// Reached via the link in the password-reset email. supabase-js reads the
// recovery token out of the URL on load (detectSessionInUrl, on by
// default) and establishes a real session for this user automatically -
// there's nothing to do here but wait a tick for that, then let them set
// a new password with updateUser().
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(true);
      if (!data.session) setInvalid(true);
    });
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) setError(updateError.message);
    else setDone(true);
  }

  if (!ready) {
    return (
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-night-muted">Loading…</div>
      </DarkGradientBg>
    );
  }

  if (invalid) {
    return (
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 text-center sm:p-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-night-text">Link expired or invalid</h1>
          <p className="mt-3 text-sm leading-relaxed text-night-muted">
            Password reset links only work once and expire after a while. Request a new one from the
            login page.
          </p>
        </div>
      </div>
      </DarkGradientBg>
    );
  }

  if (done) {
    return (
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 text-center sm:p-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-night-text">Password updated</h1>
          <p className="mt-3 text-sm text-night-muted">Taking you to your dashboard…</p>
        </div>
      </div>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-night-text">Set a new password</h1>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-night-text">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-btn border border-night-border/15 bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent"
            />
            <p className="mt-1.5 text-xs text-night-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-night-text">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-btn border border-night-border/15 bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-btn border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-homeAccent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
    </DarkGradientBg>
  );
}
