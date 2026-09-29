import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDay, todayStr } from '../lib/offers';

const inputClass =
  'w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text [color-scheme:dark] placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent';

// On the Edit listing page: the owner marks dates their item isn't
// available (repairs, their own use). Renters can't request those dates,
// and the listing's calendar shows them as unavailable. The note is only
// for the owner.
export default function BlockedDatesEditor({ listingId }) {
  const [blocks, setBlocks] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getBlockedDates(listingId).then(setBlocks).catch((err) => setError(err.message));
  }, [listingId]);

  async function add(e) {
    e.preventDefault();
    if (!start || !end) return setError('Choose a start and an end date.');
    setSaving(true);
    setError('');
    try {
      const block = await api.addBlockedDates(listingId, { start_date: start, end_date: end, note });
      setBlocks((all) => [...all, block].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setStart('');
      setEnd('');
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(blockId) {
    setError('');
    try {
      await api.removeBlockedDates(listingId, blockId);
      setBlocks((all) => all.filter((b) => b.id !== blockId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4 rounded-card border border-night-border/15 bg-night-card p-6">
      <div>
        <h2 className="text-subheading text-night-text">Availability</h2>
        <p className="mt-1 text-sm text-night-muted">
          Block dates when the item isn't available - for repairs or your own use. Renters can't request them.
        </p>
      </div>

      {blocks.length > 0 && (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-btn bg-black/20 px-3 py-2 text-sm">
              <span className="text-night-text">
                {b.start_date === b.end_date ? formatDay(b.start_date) : `${formatDay(b.start_date)} – ${formatDay(b.end_date)}`}
                {b.note && <span className="text-night-muted">{` · ${b.note}`}</span>}
              </span>
              <button type="button" onClick={() => remove(b.id)} className="shrink-0 text-xs text-red-400 hover:underline">
                Make available
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <label className="text-xs font-medium text-night-muted">
          From
          <input type="date" value={start} min={todayStr()} onChange={(e) => setStart(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-medium text-night-muted">
          To
          <input type="date" value={end} min={start || todayStr()} onChange={(e) => setEnd(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-medium text-night-muted">
          Note (only you see it)
          <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Servicing" className={`${inputClass} mt-1`} />
        </label>
        <button type="submit" disabled={saving} className="rounded-btn bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60">
          {saving ? 'Saving…' : 'Block dates'}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
