import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const inputClass =
  'w-full rounded-btn border border-line px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getMyProfile()
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name || '');
        setPhone(p.phone || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api.updateMyProfile({ full_name: fullName, phone });
      setProfile((p) => ({ ...p, ...updated }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-24 text-center text-text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-text-primary">Your profile</h1>
      <p className="mt-1 text-body text-text-muted">Manage the details other users see when you list or rent equipment.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-card border border-line bg-surface p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Email</label>
          <input type="email" value={profile?.email || ''} disabled className={`${inputClass} bg-canvas text-text-muted`} />
          <p className="mt-1 text-xs text-text-muted">Your email is managed through sign-in and can't be changed here.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Full name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your name" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="Shown to a renter/owner once a rental is approved"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm font-medium text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-btn bg-text-primary py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
