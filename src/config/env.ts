import { z } from 'zod';

/**
 * Validated, typed access to browser-visible environment variables.
 * NOTE: Next.js only inlines `process.env.NEXT_PUBLIC_*` when referenced statically,
 * hence every variable is listed explicitly below.
 */

const apiBaseSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value.startsWith('/') || /^https:\/\//i.test(value), {
    message: 'NEXT_PUBLIC_FORTUNO_API_BASE must be a same-origin path ("/...") or an https:// URL',
  })
  .transform((value) => value.replace(/\/+$/, ''));

const clientEnvSchema = z.object({
  appName: z.string().trim().min(1),
  appVersion: z.string().trim().min(1),
  fortunoApiBase: apiBaseSchema,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  return clientEnvSchema.parse({
    appName: raw.NEXT_PUBLIC_APP_NAME || 'FortunoAI Trading',
    appVersion: raw.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    fortunoApiBase: raw.NEXT_PUBLIC_FORTUNO_API_BASE || '/api/proxy',
  });
}

export const env: ClientEnv = parseClientEnv({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_FORTUNO_API_BASE: process.env.NEXT_PUBLIC_FORTUNO_API_BASE,
});

