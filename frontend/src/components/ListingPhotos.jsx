import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

export const MAX_PHOTOS = 8;

// The listing form's photos: upload several at once (straight to the
// listing-images bucket, as before), remove any, and pick which one is the
// cover - the first photo is what cards and link previews show. "Check my
// photos" asks the AI for problems renters would notice (advice only).
export default function ListingPhotos({ userId, photos, onChange, title }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [check, setCheck] = useState(null); // { byUrl, checked } | { busy } | { error }
  const problemsFor = (url) => check?.byUrl?.[url] || [];

  async function runCheck() {
    setCheck({ busy: true });
    try {
      const result = await api.checkPhotos(photos, title);
      setCheck({ byUrl: Object.fromEntries(result.photos.map((p) => [p.url, p.problems])), checked: result.photos.length });
    } catch (err) {
      setCheck({ error: err.message });
    }
  }
  const flagged = check?.byUrl ? Object.values(check.byUrl).filter((p) => p.length).length : 0;

  async function handleFiles(e) {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length || !userId) return;
    setUploading(true);
    setError('');
    const added = [];
    for (const file of files) {
      try {
        const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file);
        if (uploadError) throw uploadError;
        added.push(supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl);
      } catch (err) {
        setError(`${file.name} didn't upload: ${err.message}`);
      }
    }
    onChange([...photos, ...added].slice(0, MAX_PHOTOS));
    setUploading(false);
  }

  const remove = (url) => onChange(photos.filter((p) => p !== url));
  const makeCover = (url) => onChange([url, ...photos.filter((p) => p !== url)]);

  return (
    <div>
      {photos.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, i) => (
            <li key={url} className={`relative overflow-hidden rounded-btn border ${problemsFor(url).length ? 'border-amber-400' : 'border-night-border/15'}`}>
              <img src={url} alt={i === 0 ? 'Cover photo' : `Photo ${i + 1}`} className="aspect-square w-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded-badge bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black">Cover</span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  className="absolute left-1 top-1 rounded-badge bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80"
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
              >
                ✕
              </button>
              {problemsFor(url).length > 0 && (
                <p className="absolute inset-x-0 bottom-0 bg-amber-500/90 px-1.5 py-1 text-[10px] leading-tight text-black" title={problemsFor(url).map((p) => p.label).join('. ')}>
                  ⚠ {problemsFor(url)[0].label.split(' - ')[0]}
                  {problemsFor(url).length > 1 ? ` +${problemsFor(url).length - 1}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {photos.length < MAX_PHOTOS && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-night-border/20 px-3 py-2 text-sm text-night-text hover:bg-white/5">
          <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} className="sr-only" />
          {uploading ? 'Uploading…' : photos.length ? 'Add more photos' : 'Add photos'}
        </label>
      )}
      <p className="mt-1 text-xs text-night-muted">{`Up to ${MAX_PHOTOS} photos - show it from a few sides, and any wear or damage. The first is the cover.`}</p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {photos.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={check?.busy || uploading}
            className="inline-flex items-center gap-1.5 rounded-btn border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {check?.busy ? 'Checking…' : 'Check my photos'}
          </button>
          {check?.byUrl && (
            <span className={`text-xs ${flagged ? 'text-amber-300' : 'text-emerald-400'}`} role="status">
              {flagged
                ? `${flagged} photo${flagged === 1 ? '' : 's'} could be better - see the marked ones. It's only advice.`
                : 'Looks good - clear photos of the item.'}
            </span>
          )}
          {check?.error && <span className="text-xs text-red-400">{check.error}</span>}
        </div>
      )}
    </div>
  );
}
