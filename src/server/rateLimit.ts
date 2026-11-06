/**
 * Server-side fixed-window request counter (per key, e.g. client IP).
 * Memory is bounded: expired windows are purged and the table has a hard cap.
 *
 * NOTE: state is per server instance. On serverless platforms it is a best-effort first line of
 * defence; put a shared limiter (WAF / Redis) in front for strict global limits.
 */
export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class ServerRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60_000,
    private readonly now: () => number = Date.now,
    private readonly maxKeys: number = 10_000,
  ) {}

  consume(key: string): RateLimitDecision {
    const time = this.now();
    this.purge(time);

    let entry = this.windows.get(key);
    if (!entry || time - entry.start >= this.windowMs) {
      entry = { start: time, count: 0 };
    }
    entry.count += 1;
    this.windows.delete(key);
    this.windows.set(key, entry);

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.start + this.windowMs - time) / 1000));
    return {
      allowed: entry.count <= this.limit,
      remaining: Math.max(0, this.limit - entry.count),
      retryAfterSeconds,
    };
  }

  private purge(time: number): void {
    if (this.windows.size < this.maxKeys) return;
    for (const [key, entry] of this.windows) {
      if (time - entry.start >= this.windowMs) this.windows.delete(key);
    }
    // still full of live windows (attack): evict oldest to stay bounded
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}

