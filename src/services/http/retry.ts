import { RETRY } from '@/config/constants';
import { ApiError, NetworkError, TimeoutError } from '@/services/http/errors';
import { sleep } from '@/utils/async';

export interface RetryContext {
  method: string;
  /** True when the request carries an Idempotency-Key (so replaying it is safe). */
  hasIdempotencyKey: boolean;
}

/** Exponential backoff: base * 2^(retry-1), capped (2s, 4s, 8s ... max 30s). */
export function backoffDelay(retryNumber: number, random: () => number = Math.random): number {
  const exponential = Math.min(RETRY.maxDelayMs, RETRY.baseDelayMs * 2 ** (retryNumber - 1));
  // up to +10% jitter so parallel clients don't retry in lockstep
  return Math.round(exponential * (1 + random() * 0.1));
}

/**
 * Decides whether a failed request may be retried and after how long.
 * Returns `null` when the error must be surfaced immediately.
 *
 * Safety rules:
 *  - 429 / 503 / "idempotency in progress": the operation was not (or is guaranteed to be applied
 *    at most once) so it is safe to retry.
 *  - Network errors / timeouts: only for GETs or when an Idempotency-Key is attached, because
 *    the server may already have executed a non-idempotent request.
 *  - 422 "idempotency-key-reused" is NEVER retried with a fresh key automatically: that would
 *    risk executing the same trade twice.
 */
export function decideRetry(
  error: unknown,
  retryNumber: number,
  context: RetryContext,
  random: () => number = Math.random,
): number | null {
  if (retryNumber > RETRY.maxRetries) return null;

  if (error instanceof ApiError) {
    if (error.status === 429) {
      return Math.min(error.retryAfterMs ?? backoffDelay(retryNumber, random), RETRY.maxDelayMs);
    }
    if (error.status === 503) {
      return Math.min(error.retryAfterMs ?? RETRY.serviceUnavailableDelayMs, RETRY.maxDelayMs);
    }
    if (
      error.status === 409 &&
      error.code === 'idempotency-request-in-progress' &&
      context.hasIdempotencyKey
    ) {
      return RETRY.idempotencyInProgressDelayMs;
    }
    return null;
  }

  if (error instanceof NetworkError || error instanceof TimeoutError) {
    const replaySafe = context.method === 'GET' || context.hasIdempotencyKey;
    return replaySafe ? backoffDelay(retryNumber, random) : null;
  }

  return null;
}

export interface RetryOptions {
  signal?: AbortSignal;
  /** Returns delay in ms to retry, or null to stop. */
  decide: (error: unknown, retryNumber: number) => number | null;
  onRetry?: (info: { error: unknown; retryNumber: number; delayMs: number }) => void;
}

export async function withRetry<T>(
  task: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await task(attempt);
    } catch (error) {
      const delayMs = options.decide(error, attempt);
      if (delayMs === null) throw error;
      options.onRetry?.({ error, retryNumber: attempt, delayMs });
      await sleep(delayMs, options.signal);
    }
  }
}

