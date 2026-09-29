import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';

// The AI listing writer at the top of the listing form: the owner jots a
// few words about the item (any language) and the form's main fields are
// filled in from them - and from the photo, once one is uploaded. Nothing
// is saved; the owner checks and edits everything before publishing.
export default function ListingDraftAssistant({ imageUrl, onApply }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(null);

  async function fillIn() {
    setLoading(true);
    setError('');
    try {
      const draft = await api.draftListing({ notes, image_url: imageUrl || undefined });
      onApply(draft);
      setApplied(draft);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-btn border border-emerald-500/20 bg-emerald-500/5 p-4">
      <label htmlFor="listing-notes" className="flex items-center gap-1.5 text-sm font-medium text-night-text">
        <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        Describe your item and we'll fill in the form
      </label>
      <textarea
        id="listing-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="e.g. Mahindra 575 tractor, 2019, 45 HP, good condition, trolley included, Ludhiana"
        className="mt-2 w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fillIn}
          disabled={loading || notes.trim().length < 3}
          className="rounded-btn bg-white px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Filling in…' : applied ? 'Fill in again' : 'Fill in the form'}
        </button>
        <span className="text-xs text-night-muted">Any language is fine. Upload a photo first and it'll be used too.</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {applied && (
        <p className="mt-2 text-xs text-amber-300" role="status">
          {applied.used_photo
            ? 'Filled in by AI from your notes and photo - check every field before publishing.'
            : 'Filled in by AI from your notes - check every field before publishing.'}
        </p>
      )}
    </div>
  );
}
