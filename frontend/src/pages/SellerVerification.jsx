import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

// Deliberately does NOT collect an Aadhaar/PAN number as text anywhere -
// only a photo of the ID document, uploaded to a private bucket. Staff
// review the photo directly; see the schema.sql comment on kyc_submissions
// for why (storing raw Aadhaar data requires UIDAI authorization this app
// doesn't have). A KYC vendor API can later replace this manual review
// without changing the shape of what's stored here.
const inputClass =
  'w-full rounded-btn border border-line px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'mb-1 block text-sm font-medium text-text-secondary';

// NOTE for when automated verification (Digio) actually goes live: a
// submission can then reach 'approved' near-instantly instead of after a
// staff review. At that point this copy - and the couple-of-days framing
// in 'manual_review' below - should split into a distinct "verified
// instantly" message rather than always implying a wait. Not done now
// since DIGIO_API_KEY isn't set and every submission still takes the
// manual path (see services/idVerification.js).
const STATUS_COPY = {
  pending: {
    title: 'Verification in progress',
    body: "We've received your documents. Our staff will review them and you'll be able to list items once approved - usually within a couple of days.",
  },
  // Reachable once automated verification is live: the vendor checked the
  // submission and flagged it for a human instead of clearing it
  // instantly. Shown identically to 'pending' for now - there's nothing
  // meaningfully different to tell the user yet.
  manual_review: {
    title: 'Verification in progress',
    body: "We've received your documents. Our staff will review them and you'll be able to list items once approved - usually within a couple of days.",
  },
  approved: {
    title: "You're verified",
    body: 'Your seller account is approved. You can list items whenever you like.',
  },
  rejected: {
    title: 'Verification was not approved',
    body: 'See the reason below and resubmit with corrected documents.',
  },
};

export default function SellerVerification() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null); // profile.seller_status
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' });
  const [idFile, setIdFile] = useState(null);
  const [addressFile, setAddressFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([api.getMyProfile(), api.getMyKyc()])
      .then(([profile, kyc]) => {
        setStatus(profile.seller_status);
        setSubmission(kyc);
        if (kyc) {
          setForm({ full_name: kyc.full_name, phone: kyc.phone, address: kyc.address });
        } else {
          setForm((f) => ({ ...f, full_name: profile.full_name || '', phone: profile.phone || '' }));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function uploadDoc(file, label) {
    const path = `${user.id}/${Date.now()}-${label}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(path, file);
    if (uploadError) throw uploadError;
    return path; // private bucket - store the path, not a public URL
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!form.full_name || !form.phone || !form.address) {
      setError('Full name, phone, and address are required.');
      return;
    }
    if (!idFile && !submission) {
      setError('Please upload a photo of your Aadhaar or PAN card.');
      return;
    }

    setUploading(true);
    try {
      const id_document_url = idFile ? await uploadDoc(idFile, 'id') : submission.id_document_url;
      const address_proof_url = addressFile
        ? await uploadDoc(addressFile, 'address')
        : submission?.address_proof_url;

      const result = await api.submitKyc({ ...form, id_document_url, address_proof_url });
      setSubmission(result);
      setStatus('pending');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="py-24 text-center text-text-muted">Loading…</div>;

  const copy = submission ? STATUS_COPY[submission.status] : null;
  const canEdit = status !== 'pending' && status !== 'approved';

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-text-primary">Seller verification</h1>
      <p className="mt-2 text-body text-text-muted">
        We verify every seller before they can list equipment, to keep the marketplace safe for
        renters. This takes a couple of minutes.
      </p>

      {copy && (
        <div className="mt-6 rounded-card border border-line bg-surface p-4">
          <p className="font-semibold text-text-primary">{copy.title}</p>
          <p className="mt-1 text-sm text-text-muted">{copy.body}</p>
          {submission.status === 'rejected' && submission.rejection_reason && (
            <p className="mt-2 rounded-btn bg-red-50 px-3 py-2 text-sm text-red-700">
              {submission.rejection_reason}
            </p>
          )}
        </div>
      )}

      {success && (
        <p className="mt-4 rounded-btn bg-green-50 px-3 py-2 text-sm text-green-700">
          Submitted! We'll review it shortly.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {canEdit && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-card border border-line bg-surface p-6">
          <div>
            <label className={labelClass}>Full name (as on your ID)</label>
            <input
              className={inputClass}
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Phone number</label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Home address</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Aadhaar or PAN card photo</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            />
            <p className="mt-1 text-xs text-text-muted">
              Only our verification staff can view this. We never share it or show it publicly.
            </p>
          </div>
          <div>
            <label className={labelClass}>Proof of address (optional - utility bill, rental agreement)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setAddressFile(e.target.files?.[0] || null)}
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-btn bg-text-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Submitting…' : submission ? 'Resubmit' : 'Submit for review'}
          </button>
        </form>
      )}
    </div>
  );
}
