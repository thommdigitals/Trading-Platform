import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitExceededError, RequestAbortedError } from './errors';
import { SlidingWindowRateLimiter } from './rateLimiter';

describe('SlidingWindowRateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (limit = 2, windowMs = 1000, maxWaitMs = 5000) =>
    new SlidingWindowRateLimiter({ b: { limit, windowMs } }, { maxWaitMs });

  it('lets calls through while under budget and tracks remaining', async () => {
    const limiter = make();
    await limiter.acquire('b');
    expect(limiter.remaining('b')).toBe(1);
    await limiter.acquire('b');
    expect(limiter.remaining('b')).toBe(0);
  });

  it('ignores unknown buckets', async () => {
    const limiter = make();
    await expect(limiter.acquire('unknown')).resolves.toBeUndefined();
    expect(limiter.remaining('unknown')).toBe(Number.POSITIVE_INFINITY);
  });

  it('delays the call that exceeds the budget until the window slides', async () => {
    const limiter = make();
    await limiter.acquire('b');
    await limiter.acquire('b');

    const done = vi.fn();
    void limiter.acquire('b').then(done);
    await vi.advanceTimersByTimeAsync(900);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(done).toHaveBeenCalled();
  });

  it('serves waiters in FIFO order and never exceeds the limit', async () => {
    const limiter = make(1, 1000, 10_000);
    const order: number[] = [];
    const calls = [1, 2, 3].map((n) => limiter.acquire('b').then(() => order.push(n)));
    await vi.advanceTimersByTimeAsync(3_500);
    await Promise.all(calls);
    expect(order).toEqual([1, 2, 3]);
  });

  it('fails fast when the wait would exceed maxWaitMs', async () => {
    const limiter = make(1, 60_000, 1_000);
    await limiter.acquire('b');
    await expect(limiter.acquire('b')).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it('aborts while waiting', async () => {
    const limiter = make(1, 1000, 10_000);
    await limiter.acquire('b');
    const controller = new AbortController();
    const pending = limiter.acquire('b', controller.signal);
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestAbortedError);
    controller.abort();
    await assertion;
  });
});

