import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('keyStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates a non-extractable key once and shares it between concurrent callers', async () => {
    const { getEncryptionKey } = await import('./keyStore');
    const [a, b, c] = await Promise.all([getEncryptionKey(), getEncryptionKey(), getEncryptionKey()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.extractable).toBe(false);
  });

  it('persists the key across module reloads (same key decrypts old data)', async () => {
    const first = await import('./keyStore');
    const { encryptData, decryptData } = await import('@/utils/encryption');
    const cipher = await encryptData('persisted', await first.getEncryptionKey(), 'slot');

    vi.resetModules();
    const second = await import('./keyStore');
    expect(await decryptData(cipher, await second.getEncryptionKey(), 'slot')).toBe('persisted');
  });

  it('destroyEncryptionKey makes old ciphertext unreadable', async () => {
    const store = await import('./keyStore');
    const { encryptData, decryptData } = await import('@/utils/encryption');
    const cipher = await encryptData('gone', await store.getEncryptionKey(), 'slot');

    await store.destroyEncryptionKey();
    const fresh = await store.getEncryptionKey();
    await expect(decryptData(cipher, fresh, 'slot')).rejects.toThrow();
  });
});

