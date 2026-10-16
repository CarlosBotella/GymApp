// Archivos que se quedan solo en este dispositivo (IndexedDB):
// fotos de las máquinas y PDFs originales de Visbody.
const DB = 'gymapp-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function putFile(key: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getFile(key: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res((r.result as Blob) || null);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return null;
  }
}

export async function deleteAllFiles(): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch {
    /* nada */
  }
}

/** Reduce una foto para no llenar el móvil */
export async function shrinkImage(file: File, max = 900): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.8));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
  } catch {
    /* nada */
  }
}

/** Borra todos los archivos cuya clave empieza por prefix (p. ej. «visbody/» o «photo/») */
export async function deleteFilesWithPrefix(prefix: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      const r = st.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) return;
        if (String(c.key).startsWith(prefix)) c.delete();
        c.continue();
      };
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    /* nada */
  }
}
