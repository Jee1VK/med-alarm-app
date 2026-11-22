import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type PhotoKind, getMedPhoto } from '../utils/imageStore';

interface PhotoViewerModalProps {
  viewing: { medId: string; medName: string; kind: PhotoKind } | null;
  onClose: () => void;
}

export function PhotoViewerModal({ viewing, onClose }: PhotoViewerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (viewing && !dialog.open) {
      dialog.showModal();
    } else if (!viewing && dialog.open) {
      dialog.close();
    }
  }, [viewing]);

  useEffect(() => {
    if (!viewing) return;
    let active = true;
    void (async () => {
      setLoading(true);
      const dataUrl = await getMedPhoto(viewing.medId, viewing.kind);
      if (active) {
        setSrc(dataUrl);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [viewing]);

  const title = viewing
    ? `${viewing.medName} — ${viewing.kind === 'tablet' ? 'Tablet Photo' : 'Prescription Photo'}`
    : '';

  return (
    <dialog ref={dialogRef} aria-labelledby="photo-viewer-title" onClose={onClose} style={{ width: 'min(620px, calc(100vw - 24px))' }}>
      <div className="dialog-header">
        <h2 id="photo-viewer-title" className="dialog-title">
          {title}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close photo viewer" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="dialog-body" style={{ alignItems: 'center' }}>
        {loading && <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Loading photo…</p>}
        {!loading && src && (
          <img
            src={src}
            alt={title}
            style={{
              maxWidth: '100%',
              maxHeight: '68dvh',
              borderRadius: '8px',
              objectFit: 'contain',
              border: '1px solid var(--color-border-subtle)',
            }}
          />
        )}
        {!loading && !src && (
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Photo could not be found on this device. Edit the medicine to upload it again.
          </p>
        )}
      </div>
    </dialog>
  );
}
