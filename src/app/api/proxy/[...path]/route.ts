import type { NextRequest } from 'next/server';
import { getServerEnv } from '@/config/serverEnv';
import { handleProxyRequest } from '@/server/proxy/handler';
import { ServerRateLimiter } from '@/server/rateLimit';

/**
 * Hardened same-origin proxy to the Match-Trader API (solves browser CORS).
 * All policy lives in `src/server/proxy/*`; this file only wires dependencies.
 */

export const dynamic = 'force-dynamic';

let limiter: ServerRateLimiter | null = null;
const getLimiter = () => (limiter ??= new ServerRateLimiter(getServerEnv().proxyRateLimitPerMinute));

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context): Promise<Response> {
  const env = getServerEnv();
  const { path } = await context.params;
  return handleProxyRequest(request, path, {
    limiter: getLimiter(),
    config: {
      upstreamUrl: env.upstreamUrl,
      timeoutMs: env.proxyTimeoutMs,
      maxBodyBytes: env.proxyMaxBodyBytes,
    },
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

