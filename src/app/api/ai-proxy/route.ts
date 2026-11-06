import type { NextRequest } from 'next/server';
import { handleAiProxyRequest } from '@/server/aiProxy';
import { ServerRateLimiter } from '@/server/rateLimit';

export const dynamic = 'force-dynamic';

let limiter: ServerRateLimiter | null = null;
const getLimiter = () => (limiter ??= new ServerRateLimiter(120));

async function handle(request: NextRequest): Promise<Response> {
  return handleAiProxyRequest(request, {
    limiter: getLimiter(),
    timeoutMs: 60_000,
    maxBodyBytes: 524_288,
  });
}

export const GET = handle;
export const POST = handle;

