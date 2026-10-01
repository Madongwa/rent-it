import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, IdCard, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import useSeo from '../hooks/useSeo';
import { shrinkImage } from '../lib/chatAttachments';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

// Renter ID verification (backend lib/renterId.js). One government ID, any
// of five - Aadhaar only masked. The photo goes to private storage; owners
// only ever see "ID verified".
const ID_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar (masked)' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'pan', label: 'PAN card' },
  { value: 'passport', label: 'Passport' },
];

export default function VerifyId() {
  useSeo({ title: 'Verify your ID', path: '/verify-id' });
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [idType, setIdType] = useState('');
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyRenterId().then(setMe).catch((err) => setError(err.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!idType) return setError('Pick which ID you are uploading.');
    if (!file) return setError('Add a photo of your ID.');
    if (!file.type.startsWith('image/')) return setError('Please upload a photo (JPG or PNG) of your ID.');
    if (!consent) return setError('Please tick the box to agree.');
    setBusy(true);
    try {
      const small = await shrinkImage(file);
      const path = `${user.id}/renter-id-${Date.now()}.${small.type === 'image/png' ? 'png' : 'jpg'}`;
      const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(path, small, { contentType: small.type || 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      const out = await api.submitRenterId({ id_type: idType, document_path: path });
      setMe((m) => ({ ...m, status: out.status, verified: out.status === 'verified', rejection_reason: out.reason || null }));
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const verified = me?.verified;
  const pending = !verified && me?.status === 'pending';
  const rejected = !verified && me?.status === 'rejected';

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="flex items-center gap-2 text-heading-sm text-night-text">
          <IdCard className="h-7 w-7 text-emerald-400" aria-hidden="true" /> Verify your ID
        </h1>
        <p className="mt-2 text-body text-night-muted">
          Owners hand over equipment worth thousands of rupees to people they've never met. Verifying your ID once shows
          them an <strong className="text-night-text">"ID verified"</strong> badge next to your name. They never see the
          document itself - only that it was checked.
        </p>

        {me === null && !error && <p className="mt-8 text-night-muted">Loading…</p>}

        {verified && (
          <div className="mt-8 rounded-card border border-emerald-500/30 bg-emerald-500/10 p-5" role="status">
            <p className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Your ID is verified
            </p>
            <p className="mt-1 text-sm text-night-muted">
              {me.via_seller ? 'You passed seller verification, which covers renting too.' : 'Owners now see you as an ID-verified renter.'}
            </p>
            <Link to="/marketplace" className="mt-3 inline-block text-sm font-medium text-night-text underline-offset-2 hover:underline">
              Back to the Marketplace
            </Link>
          </div>
        )}

        {pending && (
          <div className="mt-8 rounded-card border border-amber-400/30 bg-amber-500/10 p-5" role="status">
            <p className="flex items-center gap-2 font-semibold text-amber-300">
              <Clock className="h-5 w-5" aria-hidden="true" /> A person is checking your ID
            </p>
            <p className="mt-1 text-sm text-night-muted">
              The automatic check couldn't confirm everything, so our staff will look at it - you'll get a notification. You can
              still send rental requests meanwhile (except for "ID-verified renters only" items).
            </p>
          </div>
        )}

        {rejected && me.rejection_reason && (
          <div className="mt-8 rounded-card border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
            {me.rejection_reason} Please try again below.
          </div>
        )}

        {!verified && !pending && me && (
          <form onSubmit={submit} className="mt-8 space-y-5 rounded-card border border-night-border/15 bg-night-card p-6">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-night-text">Which ID?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ID_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-2 text-sm ${
                      idType === t.value ? 'border-emerald-500/60 bg-emerald-500/10 text-night-text' : 'border-night-border/20 text-night-muted'
                    }`}
                  >
                    <input type="radio" name="id-type" value={t.value} checked={idType === t.value} onChange={() => setIdType(t.value)} className="sr-only" />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {idType === 'aadhaar' && (
              <p className="rounded-btn border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Please use the <strong>masked Aadhaar</strong> - it hides all but the last 4 digits of your number. Download it free
                at{' '}
                <a href="https://myaadhaar.uidai.gov.in" target="_blank" rel="noreferrer" className="underline">
                  myaadhaar.uidai.gov.in
                </a>{' '}
                (choose "masked" when downloading). A photo showing the full number is refused and deleted straight away.
              </p>
            )}

            <div>
              <label htmlFor="id-photo" className="mb-1 block text-sm font-medium text-night-text">
                Photo of the front of your ID
              </label>
              <input
                id="id-photo"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-night-muted file:mr-3 file:rounded-btn file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black"
              />
              <p className="mt-1 text-xs text-night-muted">Your name and photo must be clear - no glare. Your name on the ID should match your account name.</p>
            </div>

            <label className="flex items-start gap-2 text-xs text-night-muted">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>
                I agree that Rent It stores this photo privately to verify my identity, and that it may be checked by an automated
                AI service (Groq) and by Rent It staff, as described in the{' '}
                <Link to="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Checking your ID…' : 'Verify my ID'}
            </button>
          </form>
        )}

        {error && !me && <p className="mt-8 text-sm text-red-400">{error}</p>}
      </div>
    </DarkGradientBg>
  );
}
