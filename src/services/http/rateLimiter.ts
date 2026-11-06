import { RateLimitExceededError, RequestAbortedError } from '@/services/http/errors';
import { sleep } from '@/utils/async';

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimiterOptions {
  now?: () => number;
  /** Longest time `acquire` may wait before it throws `RateLimitExceededError`. */
  maxWaitMs: number;
}

/**
 * Sliding-window rate limiter used to stay inside the broker budgets *before* hitting a 429.
 * Callers `await acquire(bucket)`; the call resolves once a slot is available.
 * Waiters are served in FIFO order so bursts cannot starve each other.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly now: () => number;
  private readonly maxWaitMs: number;

  constructor(
    private readonly rules: Record<string, RateLimitRule>,
    options: RateLimiterOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.maxWaitMs = options.maxWaitMs;
  }

  /** Remaining calls in the current window for the bucket (Infinity when unrestricted). */
  remaining(bucket: string): number {
    const rule = this.rules[bucket];
    if (!rule) return Number.POSITIVE_INFINITY;
    return Math.max(0, rule.limit - this.prune(bucket, rule).length);
  }

  async acquire(bucket: string, signal?: AbortSignal): Promise<void> {
    const rule = this.rules[bucket];
    if (!rule) return;

    const previous = this.queues.get(bucket) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.waitForSlot(bucket, rule, signal));
    this.queues.set(bucket, current);
    try {
      await current;
    } finally {
      if (this.queues.get(bucket) === current) this.queues.delete(bucket);
    }
  }

  reset(): void {
    this.hits.clear();
    this.queues.clear();
  }

  private async waitForSlot(bucket: string, rule: RateLimitRule, signal?: AbortSignal): Promise<void> {
    const waitStart = this.now();
    for (;;) {
      if (signal?.aborted) throw new RequestAbortedError('Aborted while waiting for rate limit');

      const recent = this.prune(bucket, rule);
      if (recent.length < rule.limit) {
        recent.push(this.now());
        this.hits.set(bucket, recent);
        return;
      }

      const oldest = recent[0] as number;
      const waitMs = Math.max(1, oldest + rule.windowMs - this.now());
      if (this.now() - waitStart + waitMs > this.maxWaitMs) {
        throw new RateLimitExceededError(waitMs);
      }
      await sleep(waitMs, signal);
    }
  }

  private prune(bucket: string, rule: RateLimitRule): number[] {
    const threshold = this.now() - rule.windowMs;
    const recent = (this.hits.get(bucket) ?? []).filter((time) => time > threshold);
    this.hits.set(bucket, recent);
    return recent;
  }
}

