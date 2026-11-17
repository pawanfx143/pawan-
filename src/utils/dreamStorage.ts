import type { DreamEntry } from '../types/dream';
import { SEED_DREAMS } from '../data/seedDreams';

const DB_NAME = 'oniros_dream_journal_db';
const DB_VERSION = 1;
const STORE_NAME = 'dreams';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadDreams(): Promise<DreamEntry[]> {
  try {
    const db = await openDatabase();
    const entries = await new Promise<DreamEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as DreamEntry[]) ?? []);
      req.onerror = () =>
        reject(req.error ?? new Error('Failed to read dreams'));
    });

    if (entries.length === 0) {
      await saveAllDreams(SEED_DREAMS);
      return SEED_DREAMS;
    }

    return entries.sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  } catch {
    return SEED_DREAMS;
  }
}

export async function saveDream(entry: DreamEntry): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error('Failed to persist dream'));
    });
  } catch {
    // Graceful fallback in restricted browser contexts
  }
}

export async function saveAllDreams(entries: DreamEntry[]): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of entries) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error('Failed to persist dreams'));
    });
  } catch {
    // Graceful fallback
  }
}

export async function deleteDreamById(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error('Failed to delete dream'));
    });
  } catch {
    // Graceful fallback
  }
}
