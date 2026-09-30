import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

// Dashboard → Saved searches: searches saved with "Alert me" on the
// Marketplace. Each morning new matching listings arrive as a notification.
export default function SavedSearches() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSavedSearches().then(setItems).catch((err) => setError(err.message));
  }, []);

  async function remove(id) {
    setError('');
    try {
      await api.deleteSavedSearch(id);
      setItems((list) => list.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-night-muted">
        Every morning we check these for new listings and send you a notification if something turns up. Save one with
        "Alert me" on the <Link to="/marketplace" className="text-accent hover:underline">Marketplace</Link> (up to 10).
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items === null && !error && <p className="text-night-muted">Loading…</p>}
      {items?.length === 0 && <p className="text-night-muted">No saved searches yet.</p>}
      {items?.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 rounded-card border border-night-border/15 p-4">
          <Link to={`/marketplace${s.url_query ? `?${s.url_query}` : ''}`} className="flex min-w-0 items-center gap-2 text-night-text hover:underline">
            <Bell className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="truncate" translate="no">{s.label}</span>
          </Link>
          <button type="button" onClick={() => remove(s.id)} className="inline-flex shrink-0 items-center gap-1 text-sm text-red-400 hover:underline">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
          </button>
        </div>
      ))}
    </div>
  );
}
