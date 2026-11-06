'use client';

import { useEffect, useRef } from 'react';
import { POLLING } from '@/config/constants';
import { jitter } from '@/utils/async';
import { useOnlineStatus, usePageVisibility } from './usePageVisibility';

/**
 * Race-condition safe polling hook:
 *  - Uses a sequential `setTimeout` chain so a slow network request can NEVER overlap the next tick.
 *  - Automatically pauses when the browser tab is hidden or offline, and fires immediately on resume.
 *  - Applies ±`POLLING.jitterMs` jitter to prevent thundering-herd bursts across widgets.
 *  - Backs off exponentially on consecutive failures up to `POLLING.maxBackoffFactor`.
 */
export function usePolling(
  fn: () => Promise<void>,
  intervalMs: number,
  enabled: boolean = true,
): void {
  const isVisible = usePageVisibility();
  const isOnline = useOnlineStatus();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || !isVisible || !isOnline) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveErrors = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fnRef.current();
        consecutiveErrors = 0;
      } catch {
        consecutiveErrors = Math.min(consecutiveErrors + 1, 4);
      }
      if (cancelled) return;
      const factor =
        consecutiveErrors === 0
          ? 1
          : Math.min(POLLING.maxBackoffFactor, 2 ** consecutiveErrors);
      const nextDelay = Math.max(
        250,
        intervalMs * factor + jitter( Math.min(POLLING.jitterMs, intervalMs * 0.15)),
      );
      timer = setTimeout(() => {
        void tick();
      }, nextDelay);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, enabled, isVisible, isOnline]);
}
