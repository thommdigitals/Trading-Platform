import { base64ToBytes, bytesToBase64 } from '@/utils/base64';

/**
 * AES-256-GCM helpers built on the Web Crypto API.
 *
 * Each ciphertext is bound (via GCM "additional data") to the storage slot it was written to,
 * so a payload copied from one slot to another fails authentication.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12;
const FORMAT_VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface Envelope {
  v: number;
  iv: string;
  ct: string;
}

/** Generates a **non-extractable** AES-256-GCM key (raw bytes can never be read back by JS). */
export function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH_BITS }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptData(
  plaintext: string,
  key: CryptoKey,
  context: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(plaintext),
  );
  const envelope: Envelope = {
    v: FORMAT_VERSION,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipher)),
  };
  return JSON.stringify(envelope);
}

export async function decryptData(
  serialized: string,
  key: CryptoKey,
  context: string,
): Promise<string> {
  const envelope = JSON.parse(serialized) as Partial<Envelope>;
  if (envelope.v !== FORMAT_VERSION || typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
    throw new Error('Unsupported ciphertext format');
  }
  const plain = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToBytes(envelope.iv), additionalData: encoder.encode(context) },
    key,
    base64ToBytes(envelope.ct),
  );
  return decoder.decode(plain);
}

