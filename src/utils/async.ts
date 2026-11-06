import { RequestAbortedError } from '@/services/http/errors';

/** Promise based sleep that rejects as soon as the signal aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RequestAbortedError('Aborted'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RequestAbortedError('Aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Minimal async mutex. Guarantees that critical sections run strictly one after another,
 * e.g. to prevent two overlapping order submissions or automation evaluations.
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  get isLocked(): boolean {
    return this.pending > 0;
  }

  async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => undefined).then(() => {
      this.pending -= 1;
    });
    return run;
  }
}

/** Returns a copy of `value` between min and max. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Random integer jitter in [-range, +range]. */
export const jitter = (range: number, random: () => number = Math.random): number =>
  Math.round((random() * 2 - 1) * range);

