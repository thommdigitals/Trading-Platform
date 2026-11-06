import { describe, expect, it } from 'vitest';
import { parseClientEnv } from './env';
import { buildCsp, originOf, STATIC_SECURITY_HEADERS } from './security';
import { parseServerEnv } from './serverEnv';

describe('client env', () => {
  it('applies defaults and trims trailing slashes', () => {
    expect(parseClientEnv({})).toEqual({ appName: 'FortunoAI Trading', appVersion: '1.0.0', fortunoApiBase: '/api/proxy' });
    expect(parseClientEnv({ NEXT_PUBLIC_FORTUNO_API_BASE: 'https://x.test/api///' }).fortunoApiBase).toBe('https://x.test/api');
  });

  it('rejects insecure or malformed API bases', () => {
    expect(() => parseClientEnv({ NEXT_PUBLIC_FORTUNO_API_BASE: 'http://insecure.test' })).toThrow();
    expect(() => parseClientEnv({ NEXT_PUBLIC_FORTUNO_API_BASE: 'javascript:alert(1)' })).toThrow();
  });
});

describe('server env', () => {
  it('has safe defaults', () => {
    const env = parseServerEnv({});
    expect(env).toMatchObject({
      upstreamUrl: 'https://trader-api.match-trader.com',
      proxyRateLimitPerMinute: 600,
      proxyTimeoutMs: 15000,
      proxyMaxBodyBytes: 16384,
      cspExtraConnectSrc: [],
    });
  });

  it('requires an https upstream and validates numbers', () => {
    expect(() => parseServerEnv({ FORTUNO_UPSTREAM_URL: 'http://plain.test' })).toThrow();
    expect(() => parseServerEnv({ PROXY_TIMEOUT_MS: '5' })).toThrow();
    expect(() => parseServerEnv({ PROXY_RATE_LIMIT_PER_MINUTE: 'abc' })).toThrow();
  });

  it('parses extra CSP origins', () => {
    expect(parseServerEnv({ CSP_EXTRA_CONNECT_SRC: 'https://a.test  https://b.test' }).cspExtraConnectSrc).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
    expect(() => parseServerEnv({ CSP_EXTRA_CONNECT_SRC: 'not-a-url' })).toThrow();
  });
});

describe('CSP', () => {
  const base = { nonce: 'abc123', isDev: false, extraConnectSrc: ['https://api.deepseek.com'], fortunoApiOrigins: [] };

  it('uses nonce + strict-dynamic and forbids inline/eval scripts in production', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('only allows connections to known origins (+ configured extras)', () => {
    const connect = /connect-src ([^;]*)/.exec(buildCsp(base))?.[1] ?? '';
    for (const origin of ['https://api.openai.com', 'https://api.anthropic.com', 'https://generativelanguage.googleapis.com', 'https://api.mistral.ai', 'https://api.groq.com', 'http://localhost:11434', 'https://api.deepseek.com']) {
      expect(connect).toContain(origin);
    }
    expect(connect).not.toContain('*');
  });

  it('relaxes only what dev tooling needs', () => {
    const csp = buildCsp({ ...base, isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('adds an absolute API origin when direct mode is configured', () => {
    expect(buildCsp({ ...base, fortunoApiOrigins: ['https://trader-api.match-trader.com'] })).toContain('https://trader-api.match-trader.com');
    expect(originOf('/api/proxy')).toBeNull();
    expect(originOf('https://x.test/api')).toBe('https://x.test');
  });

  it('ships the baseline security headers', () => {
    const keys = STATIC_SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']));
  });
});

