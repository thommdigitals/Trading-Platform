import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ApiError,
  ContractError,
  InvalidTokenError,
  NetworkError,
  RequestAbortedError,
  TimeoutError,
} from './errors';
import { HttpClient, buildQueryString, parseRetryAfter } from './httpClient';

const TOKEN = 'aaa.bbb.ccc';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

function makeClient(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof HttpClient>[0]> = {}) {
  return new HttpClient({ baseUrl: 'https://api.test', getAuthToken: () => TOKEN, fetchImpl, ...extra });
}

describe('buildQueryString', () => {
  it('serialises arrays as repeated params and skips empty values', () => {
    expect(buildQueryString({ symbol: ['EURUSD', 'GBPUSD'], limit: 10, skip: undefined, none: null, empty: '' })).toBe(
      '?symbol=EURUSD&symbol=GBPUSD&limit=10',
    );
    expect(buildQueryString()).toBe('');
    expect(buildQueryString({ a: undefined })).toBe('');
  });

  it('url-encodes values', () => {
    expect(buildQueryString({ q: 'a b&c' })).toBe('?q=a+b%26c');
  });
});

describe('parseRetryAfter', () => {
  it('parses seconds and http-dates', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('1.5')).toBe(1500);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('garbage')).toBeUndefined();
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT', now)).toBe(10_000);
  });
});

describe('HttpClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends auth, accept and json headers and validates the response with a schema', async () => {
    const fetchMock = vi.fn(async () => json({ value: 1 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const result = await client.request({
      method: 'POST',
      path: '/x',
      body: { a: 1 },
      schema: z.object({ value: z.number() }),
      idempotencyKey: 'key-1',
    });

    expect(result).toEqual({ value: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(url).toBe('https://api.test/x');
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('Idempotency-Key')).toBe('key-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
    expect(init.credentials).toBe('omit');
  });

  it('refuses to send a malformed token (header injection guard)', async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock as unknown as typeof fetch, { getAuthToken: () => 'bad\r\ntoken' });
    await expect(client.request({ path: '/x' })).rejects.toBeInstanceOf(InvalidTokenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalises error responses into ApiError and fires onUnauthorized for 401', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () =>
      json(
        { status: 401, type: 'error://trader-api/unauthorized', title: 'Unauthorized', detail: 'bad token' },
        { status: 401 },
      ),
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, { onUnauthorized });
    await expect(client.request({ path: '/x' })).rejects.toMatchObject({ status: 401, code: 'unauthorized', detail: 'bad token' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 401 is not retried
  });

  it('handles non-JSON error bodies', async () => {
    const fetchMock = vi.fn(async () => new Response('<html>boom</html>', { status: 400 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const error = await client.request({ path: '/x' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
  });

  it('throws ContractError (without leaking values) when the schema does not match', async () => {
    const client = makeClient((async () => json({ value: 'secret-string' })) as unknown as typeof fetch);
    const error = await client.request({ path: '/x', schema: z.object({ value: z.number() }) }).catch((e) => e);
    expect(error).toBeInstanceOf(ContractError);
    expect(error.issues.join()).not.toContain('secret-string');
  });

  it('returns undefined for 204 responses', async () => {
    const client = makeClient((async () => new Response(null, { status: 204 })) as unknown as typeof fetch);
    await expect(client.request({ method: 'DELETE', path: '/x' })).resolves.toBeUndefined();
  });

  it('retries 429 honouring Retry-After and reuses the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ type: 'error://x/too-many-requests' }, { status: 429, headers: { 'retry-after': '3' } }))
      .mockResolvedValueOnce(json({ ok: true }));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const promise = client.request({
      method: 'POST',
      path: '/x',
      body: {},
      idempotencyKey: 'same-key',
      schema: z.object({ ok: z.boolean() }),
    });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toEqual({ ok: true });

    const keys = fetchMock.mock.calls.map((call) => ((call[1] as RequestInit).headers as Headers).get('Idempotency-Key'));
    expect(keys).toEqual(['same-key', 'same-key']);
  });

  it('wraps fetch failures as NetworkError and does not replay unsafe POSTs', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('failed'));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.request({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(NetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out slow requests', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, { timeoutMs: 1000 });
    const assertion = expect(client.request({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1_100);
    await assertion;
  });

  it('propagates caller aborts as RequestAbortedError', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const controller = new AbortController();
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const assertion = expect(client.request({ path: '/x', signal: controller.signal })).rejects.toBeInstanceOf(RequestAbortedError);
    controller.abort();
    await assertion;
  });

  it('reports rate-limit headers', async () => {
    const onRateLimitInfo = vi.fn();
    const client = makeClient(
      (async () =>
        json({}, { headers: { 'x-ratelimit-remaining-endpoint': '4', 'x-ratelimit-remaining-global': '90' } })) as unknown as typeof fetch,
      { onRateLimitInfo },
    );
    await client.request({ path: '/x' });
    expect(onRateLimitInfo).toHaveBeenCalledWith({ endpoint: 4, global: 90 });
  });
});

