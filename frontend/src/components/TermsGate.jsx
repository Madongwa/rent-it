import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TERMS_VERSION } from '../content/legal';

// Clickwrap: nobody can use Rent It until they tick the boxes and click
// "I agree".
//
// - Visitors without an account are asked once per visit: acceptance lives
//   in sessionStorage, which survives refreshes but not closing the tab or
//   opening the site fresh in a new one.
// - Account holders are asked once: acceptance is recorded on their profile
//   (plus an audit row - see POST /api/profiles/me/accept-terms), so they're
//   never asked again unless TERMS_VERSION changes. Someone who accepted as
//   a guest earlier in the same visit and then signs in has that recorded
//   on their account rather than being asked twice.
// - The Terms and Privacy pages themselves stay readable: there the gate is
//   a bar along the bottom instead of a full-screen dialog.
export const TERMS_SESSION_KEY = 'rentit_terms_accepted';
const DOCUMENT_PATHS = ['/terms', '/privacy'];

function acceptedThisVisit() {
  try {
    return sessionStorage.getItem(TERMS_SESSION_KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}

function rememberThisVisit() {
  try {
    sessionStorage.setItem(TERMS_SESSION_KEY, TERMS_VERSION);
  } catch {
    // Storage blocked - they'll just be asked again on the next page load.
  }
}

const KEY_POINTS = [
  "Rent It is only a marketplace. We don't own, inspect or insure any item, and we're not a party to any rental.",
  "Payments and deposits go directly between renter and owner. Rent It never handles money and can't refund, recover or guarantee it. Never pay in advance, and never share an OTP or UPI PIN.",
  'Equipment like tractors, excavators, generators, power tools and ladders can cause serious injury or death. Only use what you are trained and, where required, licensed to use - at your own risk.',
  "Renters are responsible for an item from pickup until it's returned, including damage, loss and theft.",
  'Owners must own what they list, describe it honestly, keep it safe, and follow the law (registration, insurance, taxes).',
  'Chats, offers, photos, documents and shared locations are stored and can be reviewed by Rent It staff for safety, disputes and legal requests.',
  'Meet in safe, public places. Verification is limited - it is not a guarantee about any user.',
  'Our liability is limited, disputes with Rent It go to arbitration, and you must be 18 or older.',
];

function ConsentControls({ compact, onAccept, saving }) {
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  return (
    <div className={compact ? 'flex flex-col gap-3 lg:flex-row lg:items-center' : 'space-y-3'}>
      <div className={compact ? 'flex flex-1 flex-col gap-1.5' : 'space-y-2.5'}>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-night-text">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
          />
          <span>I am 18 years of age or older.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-night-text">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
          />
          <span>
            I have read and agree to the{' '}
            <Link to="/terms" className="font-medium underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>
      <button
        type="button"
        onClick={onAccept}
        disabled={!adult || !agree || saving}
        className={`rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? 'shrink-0' : 'w-full'
        }`}
      >
        {saving ? 'Saving…' : 'I agree - continue'}
      </button>
    </div>
  );
}

export default function TermsGate() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  const [status, setStatus] = useState(() => (acceptedThisVisit() ? 'accepted' : 'checking'));
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (loading) return undefined;
    const thisVisit = acceptedThisVisit();
    if (!userId) {
      setStatus(thisVisit ? 'accepted' : 'required');
      return undefined;
    }

    let cancelled = false;
    api
      .getMyProfile()
      .then(async (profile) => {
        if (profile.terms_version === TERMS_VERSION) {
          // Covers them for the rest of this visit too, e.g. after logging out.
          rememberThisVisit();
          return 'accepted';
        }
        if (thisVisit) {
          await api.acceptTerms(TERMS_VERSION).catch(() => {});
          return 'accepted';
        }
        return 'required';
      })
      // If the profile can't be loaded, fall back to this visit's answer
      // rather than locking a signed-in user out.
      .catch(() => (thisVisit ? 'accepted' : 'required'))
      .then((next) => {
        if (!cancelled) setStatus(next);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, loading]);

  const blocking = status === 'required' && !DOCUMENT_PATHS.includes(pathname);

  // Lock the page behind the dialog and keep keyboard focus inside it.
  useEffect(() => {
    if (!blocking) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    function trapFocus(e) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
    };
  }, [blocking]);

  async function accept() {
    setSaving(true);
    rememberThisVisit();
    if (userId) {
      // If saving fails, this visit still counts; it's recorded on the
      // account the next time the page loads (see the effect above).
      await api.acceptTerms(TERMS_VERSION).catch(() => {});
    }
    setSaving(false);
    setStatus('accepted');
  }

  if (status !== 'required') return null;

  if (!blocking) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[2000] border-t border-night-border/20 bg-night-elevated/95 px-4 py-4 shadow-2xl backdrop-blur sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-sm text-night-muted">
            To use Rent It, please read these documents and accept them below.
          </p>
          <ConsentControls compact onAccept={accept} saving={saving} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-gate-title"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-night-border/20 bg-night-elevated text-night-text shadow-2xl [color-scheme:dark] focus:outline-none"
      >
        <div className="border-b border-night-border/15 px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-amber-400" aria-hidden="true" />
            <h2 id="terms-gate-title" className="text-lg font-bold">
              Before you use Rent It
            </h2>
          </div>
          <p className="mt-2 text-sm text-night-muted">
            Rent It connects people who rent equipment to each other. You need to accept our Terms of Service and Privacy
            Policy to continue. The most important points:
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ul className="space-y-2.5 text-sm text-night-muted">
            {KEY_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-night-muted">
            This is only a summary. Please read the full{' '}
            <Link to="/terms" className="font-medium text-night-text underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-night-text underline">
              Privacy Policy
            </Link>{' '}
            - they are what you are agreeing to.
          </p>
        </div>

        <div className="border-t border-night-border/15 px-6 py-5">
          <ConsentControls onAccept={accept} saving={saving} />
          <p className="mt-3 text-center text-xs text-night-muted">
            Don't agree? You can close this tab - Rent It can't be used without accepting.
          </p>
        </div>
      </div>
    </div>
  );
}
