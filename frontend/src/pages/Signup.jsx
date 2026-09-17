import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function Signup() {
  useSeo({ title: 'Sign Up', description: 'Create a Rent It account to start renting or listing equipment.', path: '/signup' });
  const { signUp, resendConfirmation } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | error

  function validate() {
    const errors = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < MIN_PASSWORD_LENGTH)
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const { data, error } = await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
    } else if (data.session) {
      navigate('/dashboard', { replace: true });
    } else {
      // Email confirmation is enabled on the Supabase project
      setNeedsConfirmation(true);
    }
  }

  async function handleResend() {
    setResendState('sending');
    const { error } = await resendConfirmation(email.trim());
    setResendState(error ? 'error' : 'sent');
  }

  if (needsConfirmation) {
    return (
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 text-center sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-night-text">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-night-muted">
            We sent a confirmation link to <strong className="text-night-text">{email}</strong>. Confirm
            your address, then log in.
          </p>

          {/* Email delivery isn't instant and can occasionally fail or land
              in spam - this is the way out of that dead end, instead of a
              silent "just wait and hope" screen. */}
          <div className="mt-6 border-t border-night-border/15 pt-5">
            {resendState === 'sent' ? (
              <p className="text-sm text-emerald-400">Sent again — check your inbox (and spam folder).</p>
            ) : (
              <>
                <p className="text-xs text-night-muted">Didn't get it?</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === 'sending'}
                  className="mt-1.5 text-sm font-medium text-homeAccent hover:underline disabled:opacity-60"
                >
                  {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
                </button>
                {resendState === 'error' && (
                  <p className="mt-2 text-sm text-red-400">
                    Couldn't resend that — please try again in a moment.
                  </p>
                )}
              </>
            )}
          </div>

          <Link
            to="/login"
            className="mt-6 inline-block font-medium text-homeAccent hover:underline"
          >
            Go to log in
          </Link>
        </div>
      </div>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-night-border/15 bg-night-card p-8 sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-night-text">Create your account</h1>
        <p className="mt-2 text-sm text-night-muted">Start listing or renting equipment in minutes.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-night-text">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
              className={`w-full rounded-btn border bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent ${
                fieldErrors.fullName ? 'border-red-500/60' : 'border-night-border/15'
              }`}
            />
            {fieldErrors.fullName && (
              <p id="fullName-error" className="mt-1.5 text-sm text-red-400">
                {fieldErrors.fullName}
              </p>
            )}
          </div>

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
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-night-text">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`w-full rounded-btn border bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent ${
                fieldErrors.password ? 'border-red-500/60' : 'border-night-border/15'
              }`}
            />
            {fieldErrors.password ? (
              <p id="password-error" className="mt-1.5 text-sm text-red-400">
                {fieldErrors.password}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-night-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-night-text">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
              className={`w-full rounded-btn border bg-black/20 px-3.5 py-2.5 text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-homeAccent ${
                fieldErrors.confirmPassword ? 'border-red-500/60' : 'border-night-border/15'
              }`}
            />
            {fieldErrors.confirmPassword && (
              <p id="confirmPassword-error" className="mt-1.5 text-sm text-red-400">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-btn border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
              {formError}
            </p>
          )}

          <p className="text-xs leading-relaxed text-night-muted">
            After you sign up, we'll email you a confirmation link — you'll need to confirm your
            address before you can log in.
          </p>

          <p className="text-xs leading-relaxed text-night-muted">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="font-medium text-homeAccent hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-homeAccent hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-homeAccent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {submitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-night-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-homeAccent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
    </DarkGradientBg>
  );
}
