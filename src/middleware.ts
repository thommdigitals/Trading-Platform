import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, originOf } from '@/config/security';
import { parseServerEnv } from '@/config/serverEnv';

/**
 * Per-request nonce based Content-Security-Policy.
 * The nonce is forwarded to the app via the `x-nonce` request header (read in the root layout).
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const serverEnv = parseServerEnv(process.env);
  const apiOrigin = originOf(process.env.NEXT_PUBLIC_FORTUNO_API_BASE ?? '');

  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== 'production',
    extraConnectSrc: serverEnv.cspExtraConnectSrc,
    fortunoApiOrigins: apiOrigin ? [apiOrigin] : [],
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

