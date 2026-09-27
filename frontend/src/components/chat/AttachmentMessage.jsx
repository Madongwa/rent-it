import { useEffect, useState } from 'react';
import { Download, FileText, MapPin } from 'lucide-react';
import { formatBytes, mapsLink, signedAttachmentUrl, tileFor } from '../../lib/chatAttachments';

// Files are in a private bucket, so each one gets a short-lived signed URL
// (Supabase only issues it to the two people in the chat, or staff).
function useSignedUrl(path, download) {
  const [state, setState] = useState({ url: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    setState({ url: null, failed: false });
    signedAttachmentUrl(path, { download })
      .then((url) => !cancelled && setState({ url, failed: false }))
      .catch(() => !cancelled && setState({ url: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [path, download]);
  return state;
}

function ImageAttachment({ attachment }) {
  const { url, failed } = useSignedUrl(attachment.path);
  if (failed) return <p className="px-1 py-2 text-xs opacity-80">Photo unavailable</p>;
  if (!url) return <div className="h-48 w-60 max-w-full animate-pulse rounded-xl bg-white/10" aria-label="Loading photo" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={attachment.name || 'Photo'} className="max-h-72 w-auto max-w-full rounded-xl object-cover" loading="lazy" />
    </a>
  );
}

const TYPE_LABEL = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.oasis.opendocument.text': 'Document',
  'application/rtf': 'Document',
  'text/plain': 'Text',
  'text/csv': 'Spreadsheet',
  'application/vnd.ms-excel': 'Spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Spreadsheet',
};

function FileAttachment({ attachment, mine }) {
  const { url } = useSignedUrl(attachment.path, attachment.name);
  const label = TYPE_LABEL[attachment.mime_type] || (attachment.mime_type?.startsWith('image/') ? 'Image' : 'File');
  return (
    <div className={`flex w-64 max-w-full items-center gap-3 rounded-xl px-3 py-2.5 ${mine ? 'bg-black/20' : 'bg-white/5'}`}>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600/80">
        <FileText className="h-5 w-5 text-white" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-[11px] opacity-70">
          {label} · {formatBytes(attachment.size)}
        </p>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Download ${attachment.name}`} className="rounded-full p-1.5 hover:bg-white/10">
          <Download className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : (
        <span className="h-7 w-7" aria-hidden="true" />
      )}
    </div>
  );
}

const MAP_ZOOM = 15;
const MAP_W = 256;
const MAP_H = 150;

// Static map preview: the 3x3 block of OpenStreetMap tiles around the
// point, shifted so the pin sits in the middle - no map library needed
// just to show where someone is.
function LocationAttachment({ attachment }) {
  const { lat, lng, label } = attachment;
  const t = tileFor(lat, lng, MAP_ZOOM);
  const offsetX = MAP_W / 2 - (256 + t.px);
  const offsetY = MAP_H / 2 - (256 + t.py);
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      tiles.push({ key: `${dx},${dy}`, x: t.x + dx, y: t.y + dy, left: (dx + 1) * 256, top: (dy + 1) * 256 });
    }
  }

  return (
    <a href={mapsLink(lat, lng)} target="_blank" rel="noreferrer" className="block w-64 max-w-full overflow-hidden rounded-xl" title="Open in Google Maps">
      <div className="relative overflow-hidden bg-white/10" style={{ height: MAP_H }}>
        <div className="absolute" style={{ left: offsetX, top: offsetY, width: 768, height: 768 }}>
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={`https://tile.openstreetmap.org/${MAP_ZOOM}/${tile.x}/${tile.y}.png`}
              alt=""
              className="absolute h-64 w-64 max-w-none"
              style={{ left: tile.left, top: tile.top }}
              loading="lazy"
            />
          ))}
        </div>
        <MapPin className="absolute h-8 w-8 fill-red-500 text-red-900 drop-shadow" style={{ left: MAP_W / 2 - 16, top: MAP_H / 2 - 30 }} aria-hidden="true" />
        <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black">© OpenStreetMap</span>
      </div>
      <div className="px-1 pt-2">
        <p className="truncate text-sm font-medium">{label || 'Shared location'}</p>
        <p className="text-[11px] opacity-70">Tap to open in Google Maps</p>
      </div>
    </a>
  );
}

export default function AttachmentMessage({ message, mine }) {
  const { kind, attachment } = message;
  if (!attachment) return <p className="whitespace-pre-line break-words">{message.body}</p>;
  if (kind === 'image') return <ImageAttachment attachment={attachment} />;
  if (kind === 'file') return <FileAttachment attachment={attachment} mine={mine} />;
  if (kind === 'location') return <LocationAttachment attachment={attachment} />;
  return <p className="whitespace-pre-line break-words">{message.body}</p>;
}
