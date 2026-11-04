// Image bytes stay in local IndexedDB; project metadata and history only retain asset IDs.
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 25 * 1024 * 1024;

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('geochase_image_elements', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.addEventListener('error', () => reject(request.error));
  });
}

export async function readImageAsset(id: string): Promise<Blob> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('assets').objectStore('assets').get(id);
      request.onsuccess = () =>
        request.result instanceof Blob
          ? resolve(request.result)
          : reject(new Error('Missing image asset'));
      request.addEventListener('error', () => reject(request.error));
    });
  } finally {
    db.close();
  }
}

export async function writeImageAsset(id: string, blob: Blob): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('assets', 'readwrite');
      transaction.objectStore('assets').put(blob, id);
      transaction.oncomplete = () => resolve();
      transaction.addEventListener('error', () => reject(transaction.error));
      transaction.addEventListener('abort', () => reject(transaction.error));
    });
  } finally {
    db.close();
  }
}

export async function inspectImageAsset(blob: Blob): Promise<{ width: number; height: number }> {
  if (!MIME_TYPES.has(blob.type) || blob.size === 0 || blob.size > MAX_BYTES)
    throw new Error('Unsupported image');
  // Not Image.decode(): it waits for the tab to be drawn, which never happens in the background.
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    if (!width || !height || width * height > 100_000_000) throw new Error('Image too large');
    return { width, height };
  } finally {
    bitmap.close();
  }
}

export async function imageAssetDataURL(id: string): Promise<string> {
  const blob = await readImageAsset(id);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

export async function importImageAsset(data: unknown): Promise<string> {
  if (
    typeof data !== 'string' ||
    data.length > MAX_BYTES * 1.4 ||
    !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(data)
  )
    throw new Error('Invalid image asset');
  const [header, encoded] = data.split(',');
  const bytes = Uint8Array.from(atob(encoded!), (char) => char.codePointAt(0)!);
  const blob = new Blob([bytes], { type: header!.slice(5, -7) });
  await inspectImageAsset(blob);
  // Never overwrite an asset referenced by another project or its undo history.
  const id = crypto.randomUUID();
  await writeImageAsset(id, blob);
  return id;
}
