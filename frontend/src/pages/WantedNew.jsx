import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import { todayStr } from '../lib/offers';

// Post a Wanted request. The AI writer turns one sentence (any language)
// into the form; the renter checks it and posts. ?text= prefills the
// writer - the Marketplace sends people here when a search finds nothing.
const EMPTY = { title: '', details: '', category_id: '', location: '', max_price_per_day: '', needed_from: '', needed_until: '' };

const inputClass =
  'w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text placeholder:text-night-muted/60 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'mb-1 block text-sm font-medium text-night-muted';

export default function WantedNew() {
  useSeo({ title: 'Post what you need', path: '/wanted/new' });
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState(searchParams.get('text') || '');
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  async function fillIn() {
    setDrafting(true);
    setError('');
    try {
      const d = await api.draftWanted(message);
      setForm({
        title: d.title || '',
        details: d.details || '',
        category_id: d.category_id ? String(d.category_id) : '',
        location: d.location || '',
        max_price_per_day: d.max_price_per_day ? String(d.max_price_per_day) : '',
        needed_from: d.needed_from || '',
        needed_until: d.needed_until || '',
      });
      setDrafted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setDrafting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createWanted({
        ...form,
        category_id: form.category_id ? Number(form.category_id) : null,
        max_price_per_day: form.max_price_per_day ? Number(form.max_price_per_day) : null,
        needed_from: form.needed_from || null,
        needed_until: form.needed_until || null,
      });
      setDone(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <h1 className="text-heading-sm text-night-text">Your request is up</h1>
          <p className="mt-2 text-body text-night-muted">
            Owners who have "<span translate="no">{done.post.title}</span>" can reply - you'll get a notification and a chat. It stays up for 30 days; close it any time from the Wanted page.
          </p>
          {done.maybe_matches.length > 0 && (
            <div className="mt-8">
              <h2 className="text-subheading text-night-text">Already listed - these might do</h2>
              <ul className="mt-3 space-y-2">
                {done.maybe_matches.map((l) => (
                  <li key={l.id}>
                    <Link to={`/listing/${l.id}`} className="flex items-center gap-3 rounded-btn border border-night-border/15 p-2 hover:border-night-border/40">
                      {l.image_url ? (
                        <img src={l.image_url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded bg-white/5" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-night-text">{l.title}</span>
                        <span className="text-xs text-night-muted">
                          ₹{Number(l.price_per_day).toLocaleString('en-IN')}/day{l.location ? ` · ${l.location}` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link to="/wanted" className="mt-8 inline-block rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90">
            See all Wanted posts
          </Link>
        </div>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-heading-sm text-night-text">Post what you need</h1>
        <p className="mt-1 text-body text-night-muted">
          Can't find it on the Marketplace? Tell owners what you're looking for - they'll reply in chat.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5 rounded-card border border-night-border/15 bg-night-card p-6">
          <div className="rounded-btn border border-emerald-500/20 bg-emerald-500/5 p-4">
            <label htmlFor="wanted-message" className="flex items-center gap-1.5 text-sm font-medium text-night-text">
              <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Say what you need and we'll fill in the form
            </label>
            <textarea
              id="wanted-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="e.g. JCB chahiye Pune me next week, foundation digging, budget 4000 per day"
              className={`${inputClass} mt-2`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={fillIn}
                disabled={drafting || message.trim().length < 3}
                className="rounded-btn bg-white px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {drafting ? 'Filling in…' : drafted ? 'Fill in again' : 'Fill in the form'}
              </button>
              <span className="text-xs text-night-muted">Any language is fine.</span>
            </div>
            {drafted && (
              <p className="mt-2 text-xs text-amber-300" role="status">
                Filled in by AI - check every field before posting.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="wanted-title">What do you need? *</label>
            <input id="wanted-title" value={form.title} onChange={(e) => update('title', e.target.value)} maxLength={120} required placeholder="e.g. JCB backhoe loader" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="wanted-details">Details</label>
            <textarea id="wanted-details" value={form.details} onChange={(e) => update('details', e.target.value)} maxLength={1000} rows={3} placeholder="What's the job? Any size, attachments or delivery needed?" className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="wanted-category">Category</label>
              <select id="wanted-category" value={form.category_id} onChange={(e) => update('category_id', e.target.value)} className={inputClass}>
                <option value="">Not sure</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="wanted-location">Where</label>
              <input id="wanted-location" value={form.location} onChange={(e) => update('location', e.target.value)} maxLength={120} placeholder="e.g. Pune, Maharashtra" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="wanted-from">From</label>
              <input id="wanted-from" type="date" min={todayStr()} value={form.needed_from} onChange={(e) => update('needed_from', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="wanted-until">Until</label>
              <input id="wanted-until" type="date" min={form.needed_from || todayStr()} value={form.needed_until} onChange={(e) => update('needed_until', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="wanted-budget">Budget (₹/day)</label>
              <input id="wanted-budget" type="number" min="1" step="1" value={form.max_price_per_day} onChange={(e) => update('max_price_per_day', e.target.value)} placeholder="Optional" className={inputClass} />
            </div>
          </div>

          <p className="text-xs text-night-muted">
            Your post is public, with your first name. Don't add phone numbers or payment details - owners reply in Rent It's chat.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className="rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60">
            {submitting ? 'Posting…' : 'Post request'}
          </button>
        </form>
      </div>
    </DarkGradientBg>
  );
}
