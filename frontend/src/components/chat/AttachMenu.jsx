import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, MapPin, Plus } from 'lucide-react';
import { DOCUMENT_ACCEPT, IMAGE_TYPES } from '../../lib/chatAttachments';

// The "+" beside Send in Messages: photos from the gallery, a photo straight
// from the camera (phones), a document such as a rental agreement, or a
// location - your current one or any place on a map.
export default function AttachMenu({ disabled, onImages, onDocument, onLocation }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const photosRef = useRef(null);
  const cameraRef = useRef(null);
  const documentRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(ref) {
    setOpen(false);
    ref.current?.click();
  }

  function takeFiles(e, handler) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) handler(files);
  }

  const items = [
    { label: 'Photos', icon: ImageIcon, color: 'bg-violet-600', onClick: () => pick(photosRef) },
    { label: 'Camera', icon: Camera, color: 'bg-rose-600', onClick: () => pick(cameraRef) },
    { label: 'Document', icon: FileText, color: 'bg-sky-600', onClick: () => pick(documentRef) },
    {
      label: 'Location',
      icon: MapPin,
      color: 'bg-emerald-600',
      onClick: () => {
        setOpen(false);
        onLocation();
      },
    },
  ];

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="Attach"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-night-border/25 text-night-text transition-transform hover:bg-white/5 disabled:opacity-50 ${
          open ? 'rotate-45 bg-white/10' : ''
        }`}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-12 right-0 z-30 w-48 overflow-hidden rounded-card border border-night-border/20 bg-night-elevated py-1.5 shadow-xl"
        >
          {items.map(({ label, icon: Icon, color, onClick }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={onClick}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-night-text hover:bg-white/5"
            >
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${color}`}>
                <Icon className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}

      <input ref={photosRef} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden data-testid="attach-photos" onChange={(e) => takeFiles(e, onImages)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden data-testid="attach-camera" onChange={(e) => takeFiles(e, onImages)} />
      <input ref={documentRef} type="file" accept={DOCUMENT_ACCEPT} multiple hidden data-testid="attach-document" onChange={(e) => takeFiles(e, onDocument)} />
    </div>
  );
}
