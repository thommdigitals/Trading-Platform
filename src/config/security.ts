import { PROVIDER_PRESETS } from './aiProviders';

/**
 * Security headers & Content-Security-Policy builder (pure => unit-testable).
 */

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  extraConnectSrc: readonly string[];
  fortunoApiOrigins: readonly string[];
}

const LOCAL_AI_ORIGINS = ['http://localhost:11434', 'http://127.0.0.1:11434'];

/** Origins of all built-in AI provider presets (plus Ollama loopback addresses). */
export function presetConnectOrigins(): string[] {
  const origins = new Set<string>(LOCAL_AI_ORIGINS);
  for (const preset of Object.values(PROVIDER_PRESETS)) {
    if (!preset.baseURL) continue;
    origins.add(new URL(preset.baseURL).origin);
  }
  return [...origins];
}

export function buildCsp({ nonce, isDev, extraConnectSrc, fortunoApiOrigins }: CspOptions): string {
  const connect = ["'self'", ...fortunoApiOrigins, ...presetConnectOrigins(), ...extraConnectSrc];
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // nonce + strict-dynamic: only scripts we emit (and what they load) may run; no inline injection
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // inline styles are required by Tailwind runtime utilities, Radix and charting libs
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [...new Set(connect)],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
  };
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

/** Static response headers applied to every route (see next.config.ts). */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

/** Origin of an absolute API base URL (relative bases such as `/api/proxy` need no CSP entry). */
export function originOf(base: string): string | null {
  if (!/^https?:\/\//i.test(base)) return null;
  return new URL(base).origin;
}
