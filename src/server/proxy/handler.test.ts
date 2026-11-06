import { describe, expect, it, vi } from 'vitest';
import { ServerRateLimiter } from '../rateLimit';
import { handleProxyRequest, type ProxyDeps } from './handler';
import { matchRoute, sanitizeQuery } from './policy';

const TOKEN = 'aaa.bbb.ccc';
const config = { upstreamUrl: 'https://upstream.test', timeoutMs: 1000, maxBodyBytes: 1024 };

function deps(fetchImpl?: typeof fetch, limit = 100): ProxyDeps {
  return { config, limiter: new ServerRateLimiter(limit), fetchImpl };
}

function req(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(`https://app.test/api/proxy/${path}`, {
    ...init,
    headers: { host: 'app.test', authorization: `Bearer ${TOKEN}`, ...init.headers },
  });
}

const segs = (path: string) => path.split('/');
const upstreamOk = () =>
  vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response('{"ok":true}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'x=1',
        'x-ratelimit-remaining-endpoint': '9',
      },
    }),
  );

describe('policy', () => {
  it('matches documented endpoints and methods only', () => {
    expect(matchRoute('GET', segs('v1/account'))).toMatchObject({ path: 'v1/account', hasBody: false });
    expect(matchRoute('POST', segs('v1/positions/123/close'))).toMatchObject({ hasBody: true });
    expect(matchRoute('DELETE', segs('v1/pending-orders/abc-1'))).toMatchObject({ method: 'DELETE' });
    expect(matchRoute('DELETE', segs('v1/positions/1'))).toBe('method-not-allowed');
    expect(matchRoute('GET', segs('v1/secret'))).toBe('not-found');
    expect(matchRoute('GET', segs('v2/account'))).toBe('not-found');
    expect(matchRoute('GET', [])).toBe('not-found');
  });

  it.each([['v1', '..', 'account'], ['v1', 'account', ''], ['v1', 'account%2f..'], ['v1', 'acc ount'], ['v1', 'a\\b']])(
    'rejects traversal-like segments %j',
    (...parts) => {
      expect(matchRoute('GET', parts)).toBe('not-found');
    },
  );

  it('sanitises query strings with an allow-list', () => {
    expect(sanitizeQuery(new URLSearchParams('symbol=EURUSD&symbol=GBPUSD&limit=10'))).toBe('?symbol=EURUSD&symbol=GBPUSD&limit=10');
    expect(sanitizeQuery(new URLSearchParams(''))).toBe('');
    expect(sanitizeQuery(new URLSearchParams('evil=1'))).toBeNull();
    expect(sanitizeQuery(new URLSearchParams('symbol=a%0d%0ab'))).toBeNull();
    expect(sanitizeQuery(new URLSearchParams('symbol=' + 'x'.repeat(100)))).toBeNull();
  });
});

describe('ServerRateLimiter', () => {
  it('limits per key within the window and resets afterwards', () => {
    let now = 0;
    const limiter = new ServerRateLimiter(2, 1000, () => now);
    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('a').allowed).toBe(true);
    const blocked = limiter.consume('a');
    expect(blocked).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume('b').allowed).toBe(true);
    now = 1000;
    expect(limiter.consume('a').allowed).toBe(true);
  });

  it('stays memory-bounded under key flooding', () => {
    const limiter = new ServerRateLimiter(5, 60_000, () => 0, 100);
    for (let i = 0; i < 1000; i += 1) limiter.consume(`ip-${i}`);
    // @ts-expect-error – inspecting private state on purpose
    expect(limiter.windows.size).toBeLessThanOrEqual(100);
  });
});

describe('handleProxyRequest', () => {
  it('forwards allowed requests to the fixed upstream with only safe headers', async () => {
    const fetchMock = upstreamOk();
    const res = await handleProxyRequest(
      req('v1/quotes?symbol=EURUSD', { headers: { cookie: 'session=secret', 'x-evil': '1' } }),
      segs('v1/quotes'),
      deps(fetchMock as unknown as typeof fetch),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://upstream.test/v1/quotes?symbol=EURUSD');
    const sent = init.headers as Headers;
    expect(sent.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(sent.get('cookie')).toBeNull();
    expect(sent.get('x-evil')).toBeNull();
    expect(init.redirect).toBe('manual');

    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('x-ratelimit-remaining-endpoint')).toBe('9');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('rejects unknown paths and methods without calling upstream', async () => {
    const fetchMock = upstreamOk();
    const d = deps(fetchMock as unknown as typeof fetch);
    expect((await handleProxyRequest(req('v1/admin'), segs('v1/admin'), d)).status).toBe(404);
    expect((await handleProxyRequest(req('v1/account', { method: 'POST', body: '{}' }), segs('v1/account'), d)).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks cross-site browsers', async () => {
    const fetchMock = upstreamOk();
    const d = deps(fetchMock as unknown as typeof fetch);
    const site = await handleProxyRequest(req('v1/account', { headers: { 'sec-fetch-site': 'cross-site' } }), segs('v1/account'), d);
    const origin = await handleProxyRequest(req('v1/account', { headers: { origin: 'https://evil.test' } }), segs('v1/account'), d);
    expect(site.status).toBe(403);
    expect(origin.status).toBe(403);
    const ok = await handleProxyRequest(req('v1/account', { headers: { origin: 'https://app.test', 'sec-fetch-site': 'same-origin' } }), segs('v1/account'), d);
    expect(ok.status).toBe(200);
  });

  it('requires a well-formed bearer token', async () => {
    const fetchMock = upstreamOk();
    const d = deps(fetchMock as unknown as typeof fetch);
    for (const authorization of ['', 'Basic abc', 'Bearer not a token', 'Bearer a.b']) {
      const res = await handleProxyRequest(req('v1/account', { headers: { authorization } }), segs('v1/account'), d);
      expect(res.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits per client', async () => {
    const d = deps(upstreamOk() as unknown as typeof fetch, 2);
    const call = () => handleProxyRequest(req('v1/account', { headers: { 'x-forwarded-for': '1.2.3.4' } }), segs('v1/account'), d);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    const limited = await call();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
  });

  it('validates body: content type, size, JSON and idempotency key', async () => {
    const fetchMock = upstreamOk();
    const d = deps(fetchMock as unknown as typeof fetch);
    const post = (init: RequestInit & { headers?: Record<string, string> }) =>
      handleProxyRequest(req('v1/positions', { method: 'POST', ...init }), segs('v1/positions'), d);

    expect((await post({ body: '{}', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await post({ body: 'x'.repeat(2000), headers: { 'content-type': 'application/json' } })).status).toBe(413);
    expect((await post({ body: '{bad', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await post({ body: '{}', headers: { 'content-type': 'application/json', 'idempotency-key': 'bad key!' } })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();

    const ok = await post({ body: '{"a":1}', headers: { 'content-type': 'application/json', 'idempotency-key': 'abcdef12-3456' } });
    expect(ok.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Headers).get('idempotency-key')).toBe('abcdef12-3456');
    expect(init.body).toBe('{"a":1}');
  });

  it('rejects unsupported query parameters', async () => {
    const res = await handleProxyRequest(req('v1/quotes?url=http://evil'), segs('v1/quotes'), deps(upstreamOk() as unknown as typeof fetch));
    expect(res.status).toBe(400);
  });

  it('maps upstream failures and refuses to follow redirects', async () => {
    const down = deps((async () => { throw new TypeError('down'); }) as unknown as typeof fetch);
    expect((await handleProxyRequest(req('v1/account'), segs('v1/account'), down)).status).toBe(502);

    const timeout = deps((async () => { throw new DOMException('t', 'TimeoutError'); }) as unknown as typeof fetch);
    expect((await handleProxyRequest(req('v1/account'), segs('v1/account'), timeout)).status).toBe(504);

    const redirect = deps((async () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } })) as unknown as typeof fetch);
    const res = await handleProxyRequest(req('v1/account'), segs('v1/account'), redirect);
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
  });

  it('passes upstream errors through with their status', async () => {
    const d = deps((async () => new Response('{"type":"error://x/not-enough-margin"}', { status: 409, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch);
    const res = await handleProxyRequest(req('v1/account'), segs('v1/account'), d);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ type: 'error://x/not-enough-margin' });
  });
});

