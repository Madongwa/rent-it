import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setSubmitting(false);

    // Show the same "check your email" screen either way - confirming
    // whether an email exists in the system is an account-enumeration
    // leak, not a UX nicety worth the tradeoff.
    if (resetError) console.error('[password reset]', resetError.message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-night-bg px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 text-center sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-night-text">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-night-muted">
            If an account exists for <strong className="text-night-text">{email}</strong>, we've sent a
            link to reset your password.
          </p>
          <Link to="/login" className="mt-6 inline-block font-medium text-homeAccent hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-night-bg px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-night-text">Reset your password</h1>
        <p className="mt-2 text-sm text-night-muted">
          Enter the email on your account and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-night-text">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-night-muted">
          <Link to="/login" className="font-medium text-homeAccent hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
