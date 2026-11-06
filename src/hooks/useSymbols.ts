'use client';

import { useCallback, useEffect } from 'react';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { getErrorMessage } from '@/utils/errorHandler';

export function useSymbols() {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const symbols = useTradingStore((s) => s.symbols);
  const loading = useTradingStore((s) => s.loading.symbols);
  const error = useTradingStore((s) => s.errors.symbols ?? null);

  const refresh = useCallback(async (force: boolean = false) => {
    if (!useConfigStore.getState().apiToken && !useConfigStore.getState().demoMode) return;
    const store = useTradingStore.getState();
    if (store.symbols.length === 0) store.setLoading('symbols', true);
    try {
      const list = await fortunoApi.getSymbols(undefined, { force });
      store.setSymbols(list);
      store.setError('symbols', null);
    } catch (err) {
      store.setError('symbols', getErrorMessage(err));
    } finally {
      store.setLoading('symbols', false);
    }
  }, []);

  useEffect(() => {
    if ((apiToken || demoMode) && symbols.length === 0) {
      void refresh();
    }
  }, [apiToken, demoMode, symbols.length, refresh]);

  return { symbols, loading, error, refresh };
}
