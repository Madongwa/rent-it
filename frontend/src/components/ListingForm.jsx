import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  CONDITION_OPTIONS,
  POWER_SOURCE_OPTIONS,
  DELIVERY_OPTIONS,
  CANCELLATION_OPTIONS,
  OWNER_TYPE_OPTIONS,
  DURATION_OPTIONS,
  MIN_RENTAL_PERIOD_OPTIONS,
} from './FilterSidebar';

// Shared by ListItem.jsx (create) and EditListing.jsx (update) - one place
// for the full field list the Marketplace filters and Listing Detail page
// actually read, instead of the original 7-field create form that left
// every new listing on column defaults invisible to half the filter
// sidebar.
const FIELD_DEFAULTS = {
  title: '',
  description: '',
  category_id: '',
  price_per_day: '',
  location: '',
  condition: 'Good',
  image_url: '',
  power_source: '',
  delivery_option: 'pickup_only',
  deposit_required: false,
  deposit_amount: '',
  cancellation_policy: 'flexible',
  owner_type: 'individual',
  accessories_included: false,
  accessories_note: '',
  min_rental_period: 'no_minimum',
  supported_durations: ['daily'],
};

const inputClass =
  'w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text placeholder:text-night-muted/60 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'mb-1 block text-sm font-medium text-night-muted';
const checkboxClass = 'h-4 w-4 rounded border-night-border/30 bg-black/20 text-accent focus:ring-accent';

function Field({ label, children, hint }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-night-muted">{hint}</p>}
    </div>
  );
}

export default function ListingForm({ initial, onSubmit, submitLabel = 'Publish listing' }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ ...FIELD_DEFAULTS, ...initial });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getCategories()
      .then((data) => {
        setCategories(data);
        if (!initial && data[0]) setForm((f) => ({ ...f, category_id: String(data[0].id) }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleDuration(value) {
    setForm((f) => {
      const has = f.supported_durations.includes(value);
      const next = has ? f.supported_durations.filter((d) => d !== value) : [...f.supported_durations, value];
      return { ...f, supported_durations: next.length ? next : f.supported_durations };
    });
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('listing-images').getPublicUrl(path);
      update('image_url', data.publicUrl);
    } catch (err) {
      setError(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.title || !form.category_id || !form.price_per_day) {
      setError('Please fill in title, category and price per day.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        category_id: Number(form.category_id),
        price_per_day: Number(form.price_per_day),
        deposit_amount: form.deposit_required && form.deposit_amount ? Number(form.deposit_amount) : null,
        power_source: form.power_source || null,
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-5 rounded-card border border-night-border/15 bg-night-card p-6">
        <h2 className="text-subheading text-night-text">Basics</h2>

        <Field label="Title *">
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Cordless Drill (18V, with case)"
            className={inputClass}
            required
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            placeholder="Describe the item, pickup instructions, etc."
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category *">
            <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} className={inputClass} required>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Condition">
            <select value={form.condition} onChange={(e) => update('condition', e.target.value)} className={inputClass}>
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Price per day (₹) *">
            <input
              type="number"
              min="0"
              step="1"
              value={form.price_per_day}
              onChange={(e) => update('price_per_day', e.target.value)}
              placeholder="750"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Location">
            <input
              type="text"
              value={form.location || ''}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Noida, Uttar Pradesh"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Photo" hint="JPG or PNG, uploaded straight to storage - no external hosting needed.">
          <div className="flex items-center gap-4">
            {form.image_url && (
              <img src={form.image_url} alt="Listing preview" className="h-16 w-16 rounded-btn object-cover" />
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} className="text-sm text-night-muted" />
            {uploading && <span className="text-xs text-night-muted">Uploading…</span>}
          </div>
        </Field>
      </div>

      <div className="space-y-5 rounded-card border border-night-border/15 bg-night-card p-6">
        <h2 className="text-subheading text-night-text">Terms</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Power source">
            <select value={form.power_source || ''} onChange={(e) => update('power_source', e.target.value)} className={inputClass}>
              <option value="">Not specified</option>
              {POWER_SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Delivery">
            <select value={form.delivery_option} onChange={(e) => update('delivery_option', e.target.value)} className={inputClass}>
              {DELIVERY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cancellation policy">
            <select value={form.cancellation_policy} onChange={(e) => update('cancellation_policy', e.target.value)} className={inputClass}>
              {CANCELLATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Listing as">
            <select value={form.owner_type} onChange={(e) => update('owner_type', e.target.value)} className={inputClass}>
              {OWNER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum rental period">
            <select value={form.min_rental_period} onChange={(e) => update('min_rental_period', e.target.value)} className={inputClass}>
              {MIN_RENTAL_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Available by">
          <div className="flex flex-wrap gap-3">
            {DURATION_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-night-muted">
                <input
                  type="checkbox"
                  checked={form.supported_durations.includes(opt.value)}
                  onChange={() => toggleDuration(opt.value)}
                  className={checkboxClass}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-night-muted">
              <input
                type="checkbox"
                checked={form.deposit_required}
                onChange={(e) => update('deposit_required', e.target.checked)}
                className={checkboxClass}
              />
              Requires a refundable deposit
            </label>
            {form.deposit_required && (
              <input
                type="number"
                min="0"
                value={form.deposit_amount}
                onChange={(e) => update('deposit_amount', e.target.value)}
                placeholder="Deposit amount (₹)"
                className={inputClass}
              />
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-night-muted">
              <input
                type="checkbox"
                checked={form.accessories_included}
                onChange={(e) => update('accessories_included', e.target.checked)}
                className={checkboxClass}
              />
              Comes with accessories
            </label>
            {form.accessories_included && (
              <input
                type="text"
                value={form.accessories_note}
                onChange={(e) => update('accessories_note', e.target.value)}
                placeholder="e.g. Includes case and two batteries"
                className={inputClass}
              />
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || uploading}
        className="w-full rounded-btn bg-white py-3 font-semibold text-black hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
