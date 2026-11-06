/**
 * Allow-list policy for the Fortuno proxy.
 * Anything not explicitly listed here is rejected, which keeps the proxy from ever being an
 * open relay (SSRF / abuse) even if the upstream host were misconfigured.
 */

export type ProxyMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const ID = '[A-Za-z0-9_-]{1,64}';

interface Route {
  method: ProxyMethod;
  pattern: RegExp;
  /** Whether the request is allowed to carry a JSON body. */
  hasBody: boolean;
}

const route = (method: ProxyMethod, path: string, hasBody = false): Route => ({
  method,
  pattern: new RegExp(`^v1/${path}$`),
  hasBody,
});

export const PROXY_ROUTES: readonly Route[] = [
  route('GET', 'platform-details'),
  route('GET', 'account'),
  route('GET', 'account-summary'),
  route('GET', 'account/summary'),
  route('GET', 'positions'),
  route('POST', 'positions', true),
  route('GET', 'closed-positions'),
  route('GET', 'positions/history'),
  route('PATCH', `positions/${ID}`, true),
  route('POST', `positions/${ID}/close`, true),
  route('GET', 'pending-orders'),
  route('POST', 'pending-orders', true),
  route('PATCH', `pending-orders/${ID}`, true),
  route('DELETE', `pending-orders/${ID}`),
  route('GET', 'symbols'),
  route('GET', 'quotes'),
  route('GET', 'candles'),
  route('GET', 'trading-hours'),
  route('GET', 'ledgers'),
];

/** Canonical upstream paths for Match-Trader API v1 when legacy aliases are requested. */
const UPSTREAM_PATH_ALIASES: Record<string, string> = {
  'v1/account/summary': 'v1/account-summary',
  'v1/positions/history': 'v1/closed-positions',
};

export const ALLOWED_QUERY_KEYS = new Set(['symbol', 'type', 'interval', 'from', 'to', 'limit']);
const QUERY_VALUE_PATTERN = /^[A-Za-z0-9._#@-]{1,64}$/;
const MAX_QUERY_PARAMS = 60;

export const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'idempotency-key', 'accept'] as const;
export const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'retry-after',
  'x-ratelimit-remaining-endpoint',
  'x-ratelimit-remaining-global',
  'x-ratelimit-limit-endpoint',
  'x-ratelimit-limit-global',
] as const;

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)$/;
export const MAX_TOKEN_LENGTH = 4_096;

export interface MatchedRoute {
  method: ProxyMethod;
  path: string;
  hasBody: boolean;
}

/** `segments` come from the URL after decoding; reject anything that could alter the path. */
export function matchRoute(method: string, segments: readonly string[]): MatchedRoute | 'not-found' | 'method-not-allowed' {
  if (segments.length === 0 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    return 'not-found';
  }
  const path = segments.join('/');
  const candidates = PROXY_ROUTES.filter((entry) => entry.pattern.test(path));
  if (candidates.length === 0) return 'not-found';
  const matched = candidates.find((entry) => entry.method === method);
  if (!matched) return 'method-not-allowed';
  const upstreamPath = UPSTREAM_PATH_ALIASES[path] ?? path;
  return { method: matched.method, path: upstreamPath, hasBody: matched.hasBody };
}

/** Returns a sanitised query string, or `null` if any parameter is not allowed. */
export function sanitizeQuery(search: URLSearchParams): string | null {
  const clean = new URLSearchParams();
  let count = 0;
  for (const [key, value] of search.entries()) {
    count += 1;
    if (count > MAX_QUERY_PARAMS) return null;
    if (!ALLOWED_QUERY_KEYS.has(key) || !QUERY_VALUE_PATTERN.test(value)) return null;
    clean.append(key, value);
  }
  const text = clean.toString();
  return text ? `?${text}` : '';
}

