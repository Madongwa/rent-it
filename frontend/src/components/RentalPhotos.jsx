import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

const STAGE_LABEL = { pickup: 'Pickup condition photos', return: 'Return condition photos' };

// Private bucket (can reveal a home address or other identifying detail),
// so thumbnails need a signed URL each - same pattern as the KYC document
// viewer in AdminDashboard.jsx, just auto-revealed since both viewers here
// are already-verified rental participants rather than a reviewing admin.
function Thumb({ path }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from('rental-photos')
      .createSignedUrl(path, 300)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <div className="h-16 w-16 animate-pulse rounded-btn bg-white/10" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="h-16 w-16 rounded-btn object-cover" />
    </a>
  );
}

export default function RentalPhotoSection({ rentalId, stage, photoPaths = [], editable, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        const path = `${rentalId}/${stage}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('rental-photos').upload(path, file);
        if (uploadError) throw uploadError;
        uploaded.push(path);
      }
      // Backend replaces the stage's whole list on each call rather than
      // appending, so the new set has to include what was already there.
      await api.submitRentalPhotos(rentalId, stage, [...photoPaths, ...uploaded]);
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-night-muted">{STAGE_LABEL[stage]}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {photoPaths.map((path) => (
          <Thumb key={path} path={path} />
        ))}
        {editable && (
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-btn border border-dashed border-night-border/25 text-center text-xs text-night-muted hover:border-night-muted">
            {uploading ? 'Uploading…' : '+ Add'}
            <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} className="hidden" />
          </label>
        )}
        {photoPaths.length === 0 && !editable && <span className="text-sm text-night-muted">None uploaded</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
