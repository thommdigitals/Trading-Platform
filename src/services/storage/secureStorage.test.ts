import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateEncryptionKey } from '@/utils/encryption';
import { SecureStorage, type StorageBackend } from './secureStorage';

class MemoryBackend implements StorageBackend {
  private readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

async function setup() {
  const backend = new MemoryBackend();
  const key = await generateEncryptionKey();
  const storage = new SecureStorage({ backend: () => backend, getKey: async () => key });
  return { backend, storage };
}

describe('SecureStorage', () => {
  it('stores ciphertext only and reads it back', async () => {
    const { backend, storage } = await setup();
    await storage.setSecure('fortuno.token', { token: 'super-secret-jwt' });

    expect(backend.getItem('fortuno.token')).not.toContain('super-secret-jwt');
    expect(await storage.getSecure<{ token: string }>('fortuno.token')).toEqual({ token: 'super-secret-jwt' });
  });

  it('returns null for missing keys', async () => {
    const { storage } = await setup();
    expect(await storage.getSecure('fortuno.nope')).toBeNull();
  });

  it('drops corrupted entries instead of throwing', async () => {
    const { backend, storage } = await setup();
    backend.setItem('fortuno.bad', 'not-json');
    expect(await storage.getSecure('fortuno.bad')).toBeNull();
    expect(backend.getItem('fortuno.bad')).toBeNull();
  });

  it('drops entries that fail schema validation (tampered structure)', async () => {
    const { backend, storage } = await setup();
    await storage.setSecure('fortuno.cfg', { a: 1 });
    const schema = z.object({ a: z.string() });
    expect(await storage.getSecure('fortuno.cfg', schema)).toBeNull();
    expect(backend.getItem('fortuno.cfg')).toBeNull();
  });

  it('removeSecure and clearAll only touch its namespace', async () => {
    const { backend, storage } = await setup();
    await storage.setSecure('fortuno.a', 1);
    await storage.setSecure('fortuno.b', 2);
    backend.setItem('other.key', 'keep');

    storage.removeSecure('fortuno.a');
    expect(backend.getItem('fortuno.a')).toBeNull();

    storage.clearAll();
    expect(backend.getItem('fortuno.b')).toBeNull();
    expect(backend.getItem('other.key')).toBe('keep');
  });

  it('is a no-op when no backend is available (SSR / disabled storage)', async () => {
    const storage = new SecureStorage({ backend: () => null, getKey: generateEncryptionKey });
    await expect(storage.setSecure('fortuno.x', 1)).resolves.toBeUndefined();
    expect(await storage.getSecure('fortuno.x')).toBeNull();
    expect(() => storage.clearAll()).not.toThrow();
  });
});

