import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  useSeo({ title: 'Log In', description: 'Log in to your Rent It account.', path: '/login' });
  const { signIn, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | error

  function validate() {
    const errors = {};
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Password is required.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setUnconfirmed(false);
    setResendState('idle');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      // Supabase's message for this case is literally "Email not
      // confirmed" - matched case-insensitively since that exact string
      // isn't a documented, guaranteed-stable API contract.
      if (/email not confirmed/i.test(error.message)) setUnconfirmed(true);
    } else {
      navigate(from, { replace: true });
    }
  }

  async function handleResend() {
    setResendState('sending');
    const { error } = await resendConfirmation(email.trim());
    setResendState(error ? 'error' : 'sent');
  }

  // DEMO ACCOUNT — REMOVE BEFORE PRODUCTION / when asked
  const DEMO_EMAIL = 'shawn@gmail.com';
  const DEMO_PASSWORD = '12345678';
  function fillDemoAccount() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setFieldErrors({});
    setFormError('');
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-night-text">Log in to Rent It</h1>
        <p className="mt-2 text-sm text-night-muted">Welcome back — enter your details below.</p>

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
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={`w-full rounded-btn border bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent ${
                fieldErrors.email ? 'border-red-500/60' : 'border-night-border/15'
              }`}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1.5 text-sm text-red-400">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-night-text">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-homeAccent hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`w-full rounded-btn border bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent ${
                fieldErrors.password ? 'border-red-500/60' : 'border-night-border/15'
              }`}
            />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1.5 text-sm text-red-400">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {formError && (
            <div role="alert" className="rounded-btn border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
              <p>{formError}</p>
              {unconfirmed &&
                (resendState === 'sent' ? (
                  <p className="mt-1.5 text-emerald-400">Sent — check your inbox (and spam folder).</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === 'sending'}
                    className="mt-1.5 block font-medium text-red-300 underline disabled:opacity-60"
                  >
                    {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                ))}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-homeAccent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {/* DEMO ACCOUNT — REMOVE BEFORE PRODUCTION / when asked */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={fillDemoAccount}
            className="text-xs text-night-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-night-text"
          >
            Try demo account
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-night-muted">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-homeAccent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
      </div>
    </DarkGradientBg>
  );
}
