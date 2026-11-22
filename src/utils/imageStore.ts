/**
 * Offline IndexedDB photo store for Tablet & Prescription reference images.
 * Compresses images client-side via Canvas (~80-150 KB JPEG) so users can store
 * hundreds of photos without ever hitting localStorage's 5 MB quota.
 */

const DB_NAME = 'medclock-photos-db';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

export type PhotoKind = 'tablet' | 'prescription';

function photoKey(medId: string, kind: PhotoKind): string {
  return `${medId}:${kind}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open photo database'));
  });
}

/** Resize & compress an uploaded File into a crisp JPEG data URL. */
export async function compressImageFile(file: File, maxDimension = 1200, quality = 0.78): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image file.'));
      el.src = bitmapUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height, 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export async function saveMedPhoto(medId: string, kind: PhotoKind, dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, photoKey(medId, kind));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save photo'));
  });
}

export async function getMedPhoto(medId: string, kind: PhotoKind): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(photoKey(medId, kind));
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteMedPhoto(medId: string, kind: PhotoKind): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(photoKey(medId, kind));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function deleteAllPhotosForMed(medId: string): Promise<void> {
  await Promise.all([deleteMedPhoto(medId, 'tablet'), deleteMedPhoto(medId, 'prescription')]);
}
