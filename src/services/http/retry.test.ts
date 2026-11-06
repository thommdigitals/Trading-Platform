import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, TimeoutError, ValidationError } from './errors';
import { backoffDelay, decideRetry, withRetry } from './retry';

const get = { method: 'GET', hasIdempotencyKey: false };
const postWithKey = { method: 'POST', hasIdempotencyKey: true };
const postNoKey = { method: 'POST', hasIdempotencyKey: false };
const rand0 = () => 0;

describe('backoffDelay', () => {
  it('doubles from 2s and caps at 30s', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n, rand0))).toEqual([
      2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });
});

describe('decideRetry', () => {
  it('retries 429 using Retry-After, falling back to backoff', () => {
    expect(decideRetry(new ApiError({ status: 429, retryAfterMs: 7000 }), 1, get, rand0)).toBe(7000);
    expect(decideRetry(new ApiError({ status: 429 }), 2, get, rand0)).toBe(4000);
    expect(decideRetry(new ApiError({ status: 429, retryAfterMs: 999_999 }), 1, get, rand0)).toBe(30_000);
  });

  it('retries 503 after 5s', () => {
    expect(decideRetry(new ApiError({ status: 503 }), 1, postNoKey, rand0)).toBe(5000);
  });

  it('retries idempotency-in-progress only when a key is attached', () => {
    const error = new ApiError({ status: 409, type: 'error://trader-api/idempotency-request-in-progress' });
    expect(decideRetry(error, 1, postWithKey, rand0)).toBe(2000);
    expect(decideRetry(error, 1, postNoKey, rand0)).toBeNull();
  });

  it('only retries network failures when replay is safe', () => {
    expect(decideRetry(new NetworkError('x'), 1, get, rand0)).toBe(2000);
    expect(decideRetry(new TimeoutError('x'), 1, postWithKey, rand0)).toBe(2000);
    expect(decideRetry(new NetworkError('x'), 1, postNoKey, rand0)).toBeNull();
  });

  it('never retries business errors, key reuse, or validation errors', () => {
    expect(decideRetry(new ApiError({ status: 409, type: 'error://x/not-enough-margin' }), 1, postWithKey)).toBeNull();
    expect(decideRetry(new ApiError({ status: 422, type: 'error://x/idempotency-key-reused' }), 1, postWithKey)).toBeNull();
    expect(decideRetry(new ApiError({ status: 400 }), 1, get)).toBeNull();
    expect(decideRetry(new ValidationError('x'), 1, get)).toBeNull();
  });

  it('stops after the maximum number of retries', () => {
    expect(decideRetry(new ApiError({ status: 429 }), 3, get, rand0)).toBe(8000);
    expect(decideRetry(new ApiError({ status: 429 }), 4, get, rand0)).toBeNull();
  });
});

describe('withRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries until success', async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 503 }))
      .mockRejectedValueOnce(new ApiError({ status: 503 }))
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();
    const promise = withRetry(task, { decide: (e, n) => decideRetry(e, n, get, rand0), onRetry });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('throws the last error when retries are exhausted', async () => {
    const task = vi.fn().mockRejectedValue(new ApiError({ status: 503 }));
    const promise = withRetry(task, { decide: (e, n) => decideRetry(e, n, get, rand0) });
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(task).toHaveBeenCalledTimes(4);
  });

  it('does not retry non-retryable errors', async () => {
    const task = vi.fn().mockRejectedValue(new ApiError({ status: 400 }));
    await expect(withRetry(task, { decide: (e, n) => decideRetry(e, n, get) })).rejects.toBeInstanceOf(ApiError);
    expect(task).toHaveBeenCalledTimes(1);
  });
});

