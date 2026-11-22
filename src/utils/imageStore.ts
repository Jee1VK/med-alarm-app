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

/** Export all stored tablet & prescription photos as a key->dataUrl map for JSON backup. */
export async function exportAllPhotos(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const result: Record<string, string> = {};
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
            result[cursor.key] = cursor.value;
          }
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

/** Restore a key->dataUrl photo map back into IndexedDB. */
export async function importAllPhotos(photos: Record<string, string>): Promise<number> {
  const entries = Object.entries(photos).filter(
    ([k, v]) => typeof k === 'string' && typeof v === 'string' && v.startsWith('data:image/')
  );
  if (entries.length === 0) return 0;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const [k, v] of entries) {
        store.put(v, k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return entries.length;
  } catch {
    return 0;
  }
}
