import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

// Deliberately does NOT collect an Aadhaar/PAN number as text anywhere -
// only photos of the ID document (front + back, per Digio's ID Card API),
// uploaded to a private bucket. See the schema.sql comment on
// kyc_submissions for why raw Aadhaar data itself is never stored
// (requires UIDAI authorization this app doesn't have).
const inputClass =
  'w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'mb-1 block text-sm font-medium text-night-muted';

// When DIGIO_CLIENT_ID/SECRET are set (see services/idVerification.js), a
// submission can reach 'approved' immediately if Digio's central-database
// check passes - otherwise (including whenever it's not configured at
// all) it lands here in 'pending'/'manual_review' for staff to look at.
const STATUS_COPY = {
  pending: {
    title: 'Verification in progress',
    body: "We've received your documents. Our staff will review them and you'll be able to list items once approved - usually within a couple of days.",
  },
  // The vendor checked the submission and flagged it for a human instead
  // of clearing it instantly (e.g. an Aadhaar submission, which this API
  // can't verify against a central database - see idVerification.js).
  // Shown identically to 'pending' - there's nothing meaningfully
  // different to tell the user.
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
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
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
    if ((!idFrontFile || !idBackFile) && !submission) {
      setError('Please upload photos of both the front and back of your Aadhaar or PAN card.');
      return;
    }

    setUploading(true);
    try {
      const id_document_url = idFrontFile ? await uploadDoc(idFrontFile, 'id-front') : submission.id_document_url;
      const id_document_back_url = idBackFile
        ? await uploadDoc(idBackFile, 'id-back')
        : submission.id_document_back_url;
      const address_proof_url = addressFile
        ? await uploadDoc(addressFile, 'address')
        : submission?.address_proof_url;

      const result = await api.submitKyc({ ...form, id_document_url, id_document_back_url, address_proof_url });
      setSubmission(result);
      setStatus('pending');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <DarkGradientBg className="min-h-[calc(100vh-4rem)] py-24 text-center text-night-muted">Loading…</DarkGradientBg>;

  const copy = submission ? STATUS_COPY[submission.status] : null;
  const canEdit = status !== 'pending' && status !== 'approved';

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-night-text">Seller verification</h1>
      <p className="mt-2 text-body text-night-muted">
        We verify every seller before they can list equipment, to keep the marketplace safe for
        renters. This takes a couple of minutes.
      </p>

      {copy && (
        <div className="mt-6 rounded-card border border-night-border/15 bg-night-card p-4">
          <p className="font-semibold text-night-text">{copy.title}</p>
          <p className="mt-1 text-sm text-night-muted">{copy.body}</p>
          {submission.status === 'rejected' && submission.rejection_reason && (
            <p className="mt-2 rounded-btn bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {submission.rejection_reason}
            </p>
          )}
        </div>
      )}

      {success && (
        <p className="mt-4 rounded-btn bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Submitted! We'll review it shortly.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {canEdit && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-card border border-night-border/15 bg-night-card p-6">
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
            <label className={labelClass}>Aadhaar or PAN card - front</label>
            <input type="file" accept="image/*" onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className={labelClass}>Aadhaar or PAN card - back</label>
            <input type="file" accept="image/*" onChange={(e) => setIdBackFile(e.target.files?.[0] || null)} />
            <p className="mt-1 text-xs text-night-muted">
              Only our verification staff (and, for automated checks, our verification provider) can view
              these. We never share them or show them publicly.
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
            className="w-full rounded-btn bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Submitting…' : submission ? 'Resubmit' : 'Submit for review'}
          </button>
        </form>
      )}
    </div>
    </DarkGradientBg>
  );
}
