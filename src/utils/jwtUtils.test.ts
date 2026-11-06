import { describe, expect, it } from 'vitest';
import { InvalidTokenError } from '@/services/http/errors';
import {
  decodeJWT,
  getAccountLogin,
  getDaysUntilExpiry,
  getEnvironment,
  getTokenExpiry,
  isTokenExpired,
  isWellFormedToken,
  tryDecodeJWT,
} from './jwtUtils';

function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature_part-1`;
}

const NOW = Date.UTC(2026, 10, 6);
const EXP = Math.floor(NOW / 1000) + 10 * 86_400 + 3_600;

describe('jwtUtils', () => {
  const token = makeToken({ exp: EXP, tradingAccountLogin: 123456, environment: 'demo-env', iat: 1 });

  it('decodes the payload', () => {
    const payload = decodeJWT(token);
    expect(payload.exp).toBe(EXP);
    expect(getAccountLogin(token)).toBe('123456');
    expect(getEnvironment(token)).toBe('demo-env');
  });

  it('computes expiry helpers', () => {
    expect(getTokenExpiry(token).getTime()).toBe(EXP * 1000);
    expect(isTokenExpired(token, NOW)).toBe(false);
    expect(isTokenExpired(token, EXP * 1000)).toBe(true);
    expect(getDaysUntilExpiry(token, NOW)).toBe(10);
    expect(getDaysUntilExpiry(token, EXP * 1000 + 5)).toBe(0);
  });

  it('handles unicode payloads', () => {
    const t = makeToken({ exp: EXP, environment: 'brøker-日本' });
    expect(getEnvironment(t)).toBe('brøker-日本');
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', 'a b.c.d', 'a.b.c\r\nX-Evil: 1', 'x'.repeat(5000)]) {
      expect(isWellFormedToken(bad)).toBe(false);
      expect(() => decodeJWT(bad)).toThrow(InvalidTokenError);
    }
    expect(tryDecodeJWT('nope')).toBeNull();
  });

  it('rejects payloads without exp or with invalid JSON', () => {
    expect(() => decodeJWT(makeToken({ foo: 'bar' }))).toThrow(InvalidTokenError);
    expect(() => decodeJWT('aaa.bbb.ccc')).toThrow(InvalidTokenError);
  });

  it('trims whitespace around a pasted token', () => {
    expect(decodeJWT(`  ${token}\n`).exp).toBe(EXP);
  });
});

