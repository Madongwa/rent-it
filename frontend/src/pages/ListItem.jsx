import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Well Used'];

export default function ListItem() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    price_per_day: '',
    location: '',
    condition: 'Good',
    image_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getCategories()
      .then((data) => {
        setCategories(data);
        if (data[0]) setForm((f) => ({ ...f, category_id: String(data[0].id) }));
      })
      .catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
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
      const created = await api.createListing({
        ...form,
        category_id: Number(form.category_id),
        price_per_day: Number(form.price_per_day),
      });
      navigate(`/listing/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-stone-900">List an item for rent</h1>
      <p className="mt-1 text-stone-500">
        Have a tool sitting idle? List it here and start earning when someone rents it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Cordless Drill (18V, with case)"
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            placeholder="Describe the item's condition, accessories included, pickup instructions, etc."
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
            <select
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => update('condition', e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Price per day (₹) *</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.price_per_day}
              onChange={(e) => update('price_per_day', e.target.value)}
              placeholder="300"
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Austin, TX"
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Image URL</label>
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => update('image_url', e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="mt-1 text-xs text-stone-400">
            Paste a link to a photo of the item. (File uploads via Supabase Storage can be added later.)
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-500 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Publishing…' : 'Publish listing'}
        </button>
      </form>
    </div>
  );
}
