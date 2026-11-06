'use client';

import { useCallback, useEffect } from 'react';
import { CANDLE_INTERVAL_MS, DEFAULT_CANDLE_COUNT, type CandleInterval } from '@/config/market';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { candleKey, useTradingStore } from '@/store/tradingStore';
import { getErrorMessage } from '@/utils/errorHandler';

export function useCandles(symbol: string, interval: CandleInterval) {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const key = candleKey(symbol, interval);
  const slice = useTradingStore((s) => s.candles[key]);
  const liveQuote = useTradingStore((s) => s.quotes[symbol]);
  const loading = useTradingStore((s) => s.loading.candles);
  const error = useTradingStore((s) => s.errors.candles ?? null);

  const refresh = useCallback(
    async (force: boolean = false) => {
      if (!symbol) return;
      if (!useConfigStore.getState().apiToken && !useConfigStore.getState().demoMode) return;
      const store = useTradingStore.getState();
      store.setLoading('candles', true);
      try {
        const list = await fortunoApi.getCandles(symbol, interval, {
          limit: DEFAULT_CANDLE_COUNT,
          force,
        });
        store.setCandles(symbol, interval, list);
        store.setError('candles', null);
      } catch (err) {
        store.setError('candles', getErrorMessage(err));
      } finally {
        store.setLoading('candles', false);
      }
    },
    [symbol, interval],
  );

  useEffect(() => {
    if (apiToken || demoMode) {
      void refresh();
    }
  }, [apiToken, demoMode, refresh]);

  // Real-time update of the last candle when a new live quote arrives
  useEffect(() => {
    if (!liveQuote) return;
    const store = useTradingStore.getState();
    const existing = store.candles[key]?.candles;
    if (!existing || existing.length === 0) return;

    const last = existing[existing.length - 1]!;
    const stepMs = CANDLE_INTERVAL_MS[interval];
    const bucketTs = Math.floor(liveQuote.timestamp / stepMs) * stepMs;
    const mid = Number(((liveQuote.bid + liveQuote.ask) / 2).toFixed(5));

    if (bucketTs <= last.timestamp) {
      if (last.close === mid) return;
      store.appendCandle(symbol, interval, {
        ...last,
        close: mid,
        high: Math.max(last.high, mid),
        low: Math.min(last.low, mid),
        tickCount: last.tickCount + 1,
      });
    } else {
      store.appendCandle(symbol, interval, {
        timestamp: bucketTs,
        open: last.close,
        high: Math.max(last.close, mid),
        low: Math.min(last.close, mid),
        close: mid,
        tickCount: 1,
      });
    }
  }, [liveQuote, symbol, interval, key]);

  return {
    candles: slice?.candles ?? [],
    loading,
    error,
    refresh,
  };
}

