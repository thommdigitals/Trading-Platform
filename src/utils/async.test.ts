import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mutex, clamp, jitter, sleep } from './async';
import { RequestAbortedError } from '@/services/http/errors';
import { TtlCache } from './ttlCache';

describe('sleep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after the delay', async () => {
    const done = vi.fn();
    void sleep(1000).then(done);
    await vi.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });

  it('rejects immediately when aborted', async () => {
    const controller = new AbortController();
    const promise = sleep(10_000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(RequestAbortedError);
    await expect(sleep(10, controller.signal)).rejects.toBeInstanceOf(RequestAbortedError);
  });
});

describe('Mutex', () => {
  it('serialises overlapping critical sections (no interleaving)', async () => {
    const mutex = new Mutex();
    const events: string[] = [];
    const task = (name: string, ms: number) => async () => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      events.push(`${name}:end`);
    };
    await Promise.all([
      mutex.runExclusive(task('a', 20)),
      mutex.runExclusive(task('b', 1)),
      mutex.runExclusive(task('c', 1)),
    ]);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
    expect(mutex.isLocked).toBe(false);
  });

  it('keeps working after a task throws', async () => {
    const mutex = new Mutex();
    await expect(mutex.runExclusive(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(mutex.runExclusive(async () => 42)).resolves.toBe(42);
  });
});

describe('math helpers', () => {
  it('clamp & jitter', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(jitter(200, () => 0)).toBe(-200);
    expect(jitter(200, () => 1)).toBe(200);
    expect(jitter(200, () => 0.5)).toBe(0);
  });
});

describe('TtlCache', () => {
  it('expires entries', () => {
    let now = 0;
    const cache = new TtlCache<number>({ now: () => now });
    cache.set('a', 1, 100);
    expect(cache.get('a')).toBe(1);
    now = 100;
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the least recently used entry', () => {
    const cache = new TtlCache<number>({ maxEntries: 2, now: () => 0 });
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    cache.get('a'); // refresh a
    cache.set('c', 3, 1000);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('coalesces concurrent loads of the same key', async () => {
    const cache = new TtlCache<string>();
    const loader = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'value';
    });
    const results = await Promise.all([
      cache.getOrLoad('k', loader, 1000),
      cache.getOrLoad('k', loader, 1000),
      cache.getOrLoad('k', loader, 1000),
    ]);
    expect(results).toEqual(['value', 'value', 'value']);
    expect(loader).toHaveBeenCalledTimes(1);
    await cache.getOrLoad('k', loader, 1000);
    expect(loader).toHaveBeenCalledTimes(1); // served from cache
  });

  it('does not cache failures and allows a retry', async () => {
    const cache = new TtlCache<string>();
    const loader = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok');
    await expect(cache.getOrLoad('k', loader, 1000)).rejects.toThrow('x');
    await expect(cache.getOrLoad('k', loader, 1000)).resolves.toBe('ok');
  });
});

