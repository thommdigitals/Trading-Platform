import type { ZodType } from 'zod';
import { decryptData, encryptData } from '@/utils/encryption';
import { getEncryptionKey } from './keyStore';

/** Minimal subset of the Web Storage API we depend on (easy to fake in tests). */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export interface SecureStorageOptions {
  /** Lazily resolves the backend (so SSR never touches `window`). */
  backend: () => StorageBackend | null;
  /** Namespace prefix of every key handled by this instance. */
  prefix?: string;
  getKey?: () => Promise<CryptoKey>;
}

/**
 * Encrypted key/value storage (AES-256-GCM). Values are JSON-serialised, encrypted, and
 * authenticated against their slot name. Corrupted / tampered entries are dropped, never thrown.
 */
export class SecureStorage {
  private readonly backend: () => StorageBackend | null;
  private readonly prefix: string;
  private readonly getKey: () => Promise<CryptoKey>;

  constructor(options: SecureStorageOptions) {
    this.backend = options.backend;
    this.prefix = options.prefix ?? 'fortuno.';
    this.getKey = options.getKey ?? getEncryptionKey;
  }

  async setSecure<T>(key: string, value: T): Promise<void> {
    const storage = this.backend();
    if (!storage) return;
    const encrypted = await encryptData(JSON.stringify(value), await this.getKey(), key);
    storage.setItem(key, encrypted);
  }

  async getSecure<T>(key: string, schema?: ZodType<T>): Promise<T | null> {
    const storage = this.backend();
    const raw = storage?.getItem(key);
    if (!storage || !raw) return null;

    try {
      const plain = await decryptData(raw, await this.getKey(), key);
      const parsed: unknown = JSON.parse(plain);
      if (!schema) return parsed as T;
      const result = schema.safeParse(parsed);
      if (!result.success) throw new Error('Stored value failed validation');
      return result.data;
    } catch {
      storage.removeItem(key);
      return null;
    }
  }

  removeSecure(key: string): void {
    this.backend()?.removeItem(key);
  }

  /** Removes every entry in this namespace. */
  clearAll(): void {
    const storage = this.backend();
    if (!storage) return;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const name = storage.key(i);
      if (name?.startsWith(this.prefix)) keys.push(name);
    }
    keys.forEach((name) => storage.removeItem(name));
  }
}

function safeBackend(kind: 'localStorage' | 'sessionStorage'): StorageBackend | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    // Access can throw when storage is disabled (privacy mode / sandboxed iframe).
    return null;
  }
}

/** Persists across browser restarts ("remember me"). */
export const persistentSecureStorage = new SecureStorage({ backend: () => safeBackend('localStorage') });
/** Cleared when the tab closes. */
export const sessionSecureStorage = new SecureStorage({ backend: () => safeBackend('sessionStorage') });

