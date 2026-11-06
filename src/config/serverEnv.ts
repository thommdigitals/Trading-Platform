import { z } from 'zod';

/**
 * Server-only configuration (proxy route + security headers).
 * Never import this file from client components.
 */

const originSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'must be http(s)');

const serverEnvSchema = z.object({
  upstreamUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'), 'FORTUNO_UPSTREAM_URL must use https')
    .transform((value) => value.replace(/\/+$/, '')),
  proxyRateLimitPerMinute: z.coerce.number().int().min(1).max(100_000),
  proxyTimeoutMs: z.coerce.number().int().min(1_000).max(60_000),
  proxyMaxBodyBytes: z.coerce.number().int().min(256).max(1_048_576),
  cspExtraConnectSrc: z.array(originSchema),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const extra = (raw.CSP_EXTRA_CONNECT_SRC ?? '')
    .split(/\s+/)
    .map((origin) => origin.trim())
    .filter(Boolean);

  return serverEnvSchema.parse({
    upstreamUrl: raw.FORTUNO_UPSTREAM_URL || 'https://trader-api.match-trader.com',
    proxyRateLimitPerMinute: raw.PROXY_RATE_LIMIT_PER_MINUTE || '600',
    proxyTimeoutMs: raw.PROXY_TIMEOUT_MS || '15000',
    proxyMaxBodyBytes: raw.PROXY_MAX_BODY_BYTES || '16384',
    cspExtraConnectSrc: extra,
  });
}

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Test helper. */
export function resetServerEnvCache(): void {
  cached = null;
}

