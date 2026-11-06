import { describe, expect, it } from 'vitest';
import { decryptData, encryptData, generateEncryptionKey } from './encryption';

describe('encryption (AES-256-GCM)', () => {
  it('round-trips unicode text', async () => {
    const key = await generateEncryptionKey();
    const secret = 'token-ü-日本語-🔐';
    const cipher = await encryptData(secret, key, 'slot');
    expect(cipher).not.toContain('token');
    expect(await decryptData(cipher, key, 'slot')).toBe(secret);
  });

  it('produces a different ciphertext every time (random IV)', async () => {
    const key = await generateEncryptionKey();
    const a = await encryptData('same', key, 'slot');
    const b = await encryptData('same', key, 'slot');
    expect(a).not.toBe(b);
  });

  it('keys are non-extractable', async () => {
    const key = await generateEncryptionKey();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('rejects a payload moved to another slot (AAD binding)', async () => {
    const key = await generateEncryptionKey();
    const cipher = await encryptData('secret', key, 'slot-a');
    await expect(decryptData(cipher, key, 'slot-b')).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const key = await generateEncryptionKey();
    const envelope = JSON.parse(await encryptData('secret', key, 'slot'));
    const bytes = Buffer.from(envelope.ct, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    envelope.ct = bytes.toString('base64');
    await expect(decryptData(JSON.stringify(envelope), key, 'slot')).rejects.toThrow();
  });

  it('rejects the wrong key and unknown formats', async () => {
    const [k1, k2] = await Promise.all([generateEncryptionKey(), generateEncryptionKey()]);
    const cipher = await encryptData('secret', k1, 'slot');
    await expect(decryptData(cipher, k2, 'slot')).rejects.toThrow();
    await expect(decryptData('{"v":99}', k1, 'slot')).rejects.toThrow('Unsupported');
  });
});

