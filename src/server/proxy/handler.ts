import {
  BEARER_PATTERN,
  FORWARDED_RESPONSE_HEADERS,
  IDEMPOTENCY_KEY_PATTERN,
  MAX_TOKEN_LENGTH,
  matchRoute,
  sanitizeQuery,
} from './policy';
import type { ServerRateLimiter } from '../rateLimit';

export interface ProxyConfig {
  upstreamUrl: string;
  timeoutMs: number;
  maxBodyBytes: number;
}

export interface ProxyDeps {
  config: ProxyConfig;
  limiter: ServerRateLimiter;
  fetchImpl?: typeof fetch;
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function problem(status: number, code: string, title: string, extra: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ status, type: `error://proxy/${code}`, title, detail: title }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...NO_STORE, ...extra },
    },
  );
}

/** Best effort client identification used only for rate limiting. */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  return (forwarded || real || 'unknown').slice(0, 64);
}

/**
 * Browsers always label cross-site calls via Sec-Fetch-Site / Origin. Rejecting them keeps other
 * websites from using this deployment as a free relay.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
      return Boolean(host) && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

export async function handleProxyRequest(
  request: Request,
  segments: readonly string[],
  deps: ProxyDeps,
): Promise<Response> {
  const { config, limiter } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const matched = matchRoute(request.method, segments);
  if (matched === 'not-found') return problem(404, 'path-not-found', 'Endpoint not found');
  if (matched === 'method-not-allowed') return problem(405, 'method-not-allowed', 'Method not allowed');

  if (!isSameOrigin(request)) return problem(403, 'forbidden-origin', 'Cross-origin requests are not allowed');

  const decision = limiter.consume(getClientKey(request));
  if (!decision.allowed) {
    return problem(429, 'too-many-requests', 'Too many requests', {
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }

  const authorization = request.headers.get('authorization') ?? '';
  const bearer = BEARER_PATTERN.exec(authorization);
  if (!bearer || (bearer[1] as string).length > MAX_TOKEN_LENGTH) {
    return problem(401, 'unauthorized', 'Missing or malformed bearer token');
  }

  const query = sanitizeQuery(new URL(request.url).searchParams);
  if (query === null) return problem(400, 'bad-request', 'Unsupported query parameters');

  const headers = new Headers({ Authorization: authorization, Accept: 'application/json' });

  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) {
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return problem(400, 'bad-request', 'Invalid Idempotency-Key');
    }
    headers.set('Idempotency-Key', idempotencyKey);
  }

  let body: string | undefined;
  if (matched.hasBody) {
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return problem(415, 'unsupported-media-type', 'Content-Type must be application/json');
    }
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > config.maxBodyBytes) return problem(413, 'payload-too-large', 'Payload too large');

    body = await request.text();
    if (new TextEncoder().encode(body).length > config.maxBodyBytes) {
      return problem(413, 'payload-too-large', 'Payload too large');
    }
    try {
      JSON.parse(body);
    } catch {
      return problem(400, 'bad-request', 'Body must be valid JSON');
    }
    headers.set('Content-Type', 'application/json');
  }

  let upstream: Response;
  try {
    upstream = await fetchImpl(`${config.upstreamUrl}/${matched.path}${query}`, {
      method: matched.method,
      headers,
      body,
      redirect: 'manual', // never follow redirects with a bearer token attached
      cache: 'no-store',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return timedOut
      ? problem(504, 'upstream-timeout', 'Upstream timed out')
      : problem(502, 'upstream-unavailable', 'Upstream unavailable');
  }

  const responseHeaders = new Headers(NO_STORE);
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return problem(502, 'upstream-redirect', 'Unexpected upstream redirect');
  }

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

