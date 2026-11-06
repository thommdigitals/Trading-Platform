'use client';

import { useCallback } from 'react';
import { POLLING } from '@/config/constants';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { getErrorMessage } from '@/utils/errorHandler';
import { usePolling } from './usePolling';

export function useAccount(enablePolling: boolean = true) {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const account = useTradingStore((s) => s.account);
  const accountSummary = useTradingStore((s) => s.accountSummary);
  const platformDetails = useTradingStore((s) => s.platformDetails);
  const loading = useTradingStore((s) => s.loading.account);
  const error = useTradingStore((s) => s.errors.account ?? null);

  const canFetch = Boolean(apiToken || demoMode);

  const refresh = useCallback(async () => {
    if (!useConfigStore.getState().apiToken && !useConfigStore.getState().demoMode) return;
    const store = useTradingStore.getState();
    if (!store.account) store.setLoading('account', true);

    try {
      const [acc, summary, details] = await Promise.all([
        fortunoApi.getAccount(),
        fortunoApi.getAccountSummary(),
        store.platformDetails
          ? Promise.resolve(store.platformDetails)
          : fortunoApi.getPlatformDetails().catch(() => null),
      ]);
      store.setAccount(acc);
      store.setAccountSummary(summary);
      if (details) store.setPlatformDetails(details);
      store.setConnected(true, null);
      store.setError('account', null);
    } catch (err) {
      const msg = getErrorMessage(err);
      store.setError('account', msg);
    } finally {
      store.setLoading('account', false);
    }
  }, []);

  usePolling(refresh, POLLING.accountMs, enablePolling && canFetch);

  return {
    account,
    accountSummary,
    platformDetails,
    loading,
    error,
    refresh,
  };
}

