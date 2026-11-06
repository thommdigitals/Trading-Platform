import { STORAGE_KEYS } from '@/config/constants';
import { generateEncryptionKey } from '@/utils/encryption';

/**
 * Holds the master encryption key.
 *
 * The key is generated once as a non-extractable CryptoKey and persisted in IndexedDB
 * (structured clone keeps it non-extractable). Page scripts can *use* it but can never export the
 * raw bytes, which prevents trivial exfiltration of localStorage + key together.
 * If IndexedDB is unavailable the key lives in memory only (data then does not survive reloads).
 */

const STORE_NAME = 'keys';
const KEY_ID = 'master';

let keyPromise: Promise<CryptoKey> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_KEYS.encryptionDb, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T>(db: IDBDatabase, mode: IDBTransactionMode, build: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = build(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  if (typeof indexedDB === 'undefined') return generateEncryptionKey();

  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return generateEncryptionKey();
  }

  try {
    const existing = await runRequest<CryptoKey | undefined>(db, 'readonly', (s) => s.get(KEY_ID));
    if (existing) return existing;

    const created = await generateEncryptionKey();
    await runRequest(db, 'readwrite', (s) => s.put(created, KEY_ID));
    return created;
  } catch {
    return generateEncryptionKey();
  } finally {
    db.close();
  }
}

/** Memoised so concurrent callers never create two different keys (race-condition safe). */
export function getEncryptionKey(): Promise<CryptoKey> {
  keyPromise ??= loadOrCreateKey();
  return keyPromise;
}

/** Drops the persisted key; all previously encrypted data becomes unreadable (used on logout). */
export async function destroyEncryptionKey(): Promise<void> {
  keyPromise = null;
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDatabase();
    try {
      await runRequest(db, 'readwrite', (s) => s.delete(KEY_ID));
    } finally {
      db.close();
    }
  } catch {
    /* nothing persisted -> nothing to destroy */
  }
}

