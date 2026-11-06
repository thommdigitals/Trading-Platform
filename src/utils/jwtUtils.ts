import { z } from 'zod';
import { InvalidTokenError } from '@/services/http/errors';

/**
 * Client-side JWT helpers. The signature is NOT verified here (impossible without the secret);
 * decoded data is only used for UX (expiry warnings, display). The API is the source of truth.
 */

const MAX_TOKEN_LENGTH = 4_096;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const MS_PER_DAY = 86_400_000;

const payloadSchema = z.object({
  exp: z.number().finite(),
  iat: z.number().finite().optional(),
  tradingAccountLogin: z.union([z.number(), z.string()]).optional(),
  environment: z.string().optional(),
  tokenUuid: z.string().optional(),
  jti: z.string().optional(),
});

export type JwtPayload = z.infer<typeof payloadSchema>;

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Cheap structural check that also guarantees the value is safe to place in an HTTP header. */
export function isWellFormedToken(token: string): boolean {
  return token.length > 0 && token.length <= MAX_TOKEN_LENGTH && TOKEN_PATTERN.test(token);
}

export function decodeJWT(token: string): JwtPayload {
  const trimmed = token.trim();
  if (!isWellFormedToken(trimmed)) {
    throw new InvalidTokenError('Format token tidak valid');
  }
  try {
    const payloadPart = trimmed.split('.')[1] as string;
    const parsed = payloadSchema.safeParse(JSON.parse(base64UrlDecode(payloadPart)));
    if (!parsed.success) throw new InvalidTokenError('Payload token tidak lengkap');
    return parsed.data;
  } catch (error) {
    if (error instanceof InvalidTokenError) throw error;
    throw new InvalidTokenError('Token tidak dapat dibaca', { cause: error });
  }
}

export function tryDecodeJWT(token: string): JwtPayload | null {
  try {
    return decodeJWT(token);
  } catch {
    return null;
  }
}

export const getTokenExpiry = (token: string): Date => new Date(decodeJWT(token).exp * 1000);

export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  return getTokenExpiry(token).getTime() <= now;
}

/** Whole days remaining (rounded down, never negative). */
export function getDaysUntilExpiry(token: string, now: number = Date.now()): number {
  const remaining = getTokenExpiry(token).getTime() - now;
  return remaining <= 0 ? 0 : Math.floor(remaining / MS_PER_DAY);
}

export function getAccountLogin(token: string): string | null {
  const login = decodeJWT(token).tradingAccountLogin;
  return login === undefined ? null : String(login);
}

export const getEnvironment = (token: string): string | null =>
  decodeJWT(token).environment ?? null;

