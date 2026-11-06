'use client';

import { useCallback } from 'react';
import { POLLING } from '@/config/constants';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { getErrorMessage } from '@/utils/errorHandler';
import { usePolling } from './usePolling';

export function useQuotes(extraSymbols: readonly string[] = [], enablePolling: boolean = true) {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const watchlist = useConfigStore((s) => s.watchlist);
  const defaultSymbol = useConfigStore((s) => s.defaultSymbol);
  const quotes = useTradingStore((s) => s.quotes);
  const previousQuotes = useTradingStore((s) => s.previousQuotes);
  const loading = useTradingStore((s) => s.loading.quotes);
  const error = useTradingStore((s) => s.errors.quotes ?? null);

  const canFetch = Boolean(apiToken || demoMode);
  const extraKey = extraSymbols.join(',');

  const refresh = useCallback(async () => {
    if (!useConfigStore.getState().apiToken && !useConfigStore.getState().demoMode) return;
    const store = useTradingStore.getState();
    const cfg = useConfigStore.getState();
    const posSymbols = store.positions.map((p) => p.symbol);
    const ordSymbols = store.pendingOrders.map((o) => o.symbol);
    const extras = extraKey ? extraKey.split(',').filter(Boolean) : [];
    const targetSymbols = [
      ...new Set([...cfg.watchlist, cfg.defaultSymbol, ...posSymbols, ...ordSymbols, ...extras]),
    ].filter(Boolean);

    if (targetSymbols.length === 0) return;
    if (Object.keys(store.quotes).length === 0) store.setLoading('quotes', true);

    try {
      const list = await fortunoApi.getQuotes(targetSymbols);
      store.setQuotes(list);
      store.setError('quotes', null);
    } catch (err) {
      store.setError('quotes', getErrorMessage(err));
    } finally {
      store.setLoading('quotes', false);
    }
  }, [extraKey]);

  usePolling(
    refresh,
    POLLING.quotesMs,
    enablePolling && canFetch && (watchlist.length > 0 || Boolean(defaultSymbol)),
  );

  return { quotes, previousQuotes, loading, error, refresh };
}
