import { getClientKey, isSameOrigin } from './proxy/handler';
import type { ServerRateLimiter } from './rateLimit';

const ALLOWED_AI_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'x-api-key',
  'anthropic-version',
] as const;

const PRIVATE_HOST_PATTERNS: readonly RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.0\.0\.0$/,
  /^metadata\.google\.internal$/i,
];

/**
 * Validates that the target AI provider URL is safe to connect to from the server:
 *  - Allows `https://` to public AI provider hosts (OpenAI, Anthropic, Gemini, KiosAPI, OpenRouter, etc.)
 *  - Allows `http://localhost` and `http://127.0.0.1` for local Ollama / LM Studio / vLLM
 *  - Rejects RFC1918 private networks and cloud metadata endpoints (SSRF protection)
 */
export function validateAiTargetUrl(raw: string | null): URL | null {
  if (!raw || raw.length > 2048) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1';

  if (parsed.protocol === 'http:') {
    if (!isLoopback) return null;
  } else if (parsed.protocol !== 'https:') {
    return null;
  }

  if (!isLoopback && PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
    return null;
  }

  return parsed;
}

export interface AiProxyDeps {
  limiter: ServerRateLimiter;
  timeoutMs?: number;
  maxBodyBytes?: number;
  fetchImpl?: typeof fetch;
}

function jsonError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: { message, status } }),
    {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  );
}

export async function handleAiProxyRequest(
  request: Request,
  deps: AiProxyDeps,
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, 'Cross-origin requests are not allowed');
  }

  const decision = deps.limiter.consume(getClientKey(request));
  if (!decision.allowed) {
    return jsonError(429, 'Too many AI proxy requests, please wait a moment');
  }

  const targetUrl = validateAiTargetUrl(request.headers.get('x-ai-target-url'));
  if (!targetUrl) {
    return jsonError(
      400,
      'Invalid or disallowed AI provider URL. Use https:// (or http://localhost for local models).',
    );
  }

  const targetMethod = (request.headers.get('x-ai-target-method') || request.method || 'GET').toUpperCase();
  if (targetMethod !== 'GET' && targetMethod !== 'POST') {
    return jsonError(405, 'Only GET and POST methods are supported by AI proxy');
  }

  const forwardHeaders = new Headers();
  for (const name of ALLOWED_AI_REQUEST_HEADERS) {
    const val = request.headers.get(name);
    if (val) forwardHeaders.set(name, val);
  }
  if (!forwardHeaders.has('accept')) {
    forwardHeaders.set('accept', 'application/json, text/event-stream');
  }

  const maxBodyBytes = deps.maxBodyBytes ?? 524_288; // 512 KB for long chat histories
  let bodyText: string | undefined;
  if (targetMethod === 'POST') {
    bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).length > maxBodyBytes) {
      return jsonError(413, 'AI request payload exceeds maximum size');
    }
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 60_000;

  try {
    const upstream = await fetchImpl(targetUrl.toString(), {
      method: targetMethod,
      headers: forwardHeaders,
      body: targetMethod === 'POST' ? bodyText : undefined,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    return jsonError(
      timedOut ? 504 : 502,
      timedOut
        ? 'AI provider request timed out'
        : `Failed to reach AI provider (${targetUrl.origin}): ${err instanceof Error ? err.message : 'Network error'}`,
    );
  }
}

