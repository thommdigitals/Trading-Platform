'use client';

import { useCallback } from 'react';
import { POLLING } from '@/config/constants';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { CreatePendingOrderRequest, UpdatePendingOrderRequest } from '@/types/api';
import { Mutex } from '@/utils/async';
import { getErrorMessage } from '@/utils/errorHandler';
import { usePolling } from './usePolling';

const orderActionMutex = new Mutex();

export function usePendingOrders(enablePolling: boolean = true) {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);
  const loading = useTradingStore((s) => s.loading.pendingOrders);
  const error = useTradingStore((s) => s.errors.pendingOrders ?? null);

  const canFetch = Boolean(apiToken || demoMode);

  const refresh = useCallback(async () => {
    if (!useConfigStore.getState().apiToken && !useConfigStore.getState().demoMode) return;
    const store = useTradingStore.getState();
    if (store.pendingOrders.length === 0) store.setLoading('pendingOrders', true);
    try {
      const orders = await fortunoApi.getPendingOrders();
      store.setPendingOrders(orders);
      store.setError('pendingOrders', null);
    } catch (err) {
      store.setError('pendingOrders', getErrorMessage(err));
    } finally {
      store.setLoading('pendingOrders', false);
    }
  }, []);

  usePolling(refresh, POLLING.pendingOrdersMs, enablePolling && canFetch);

  const createPendingOrder = useCallback(
    async (request: CreatePendingOrderRequest) =>
      orderActionMutex.runExclusive(async () => {
        const res = await fortunoApi.createPendingOrder(request);
        await refresh();
        return res;
      }),
    [refresh],
  );

  const updatePendingOrder = useCallback(
    async (id: string, update: UpdatePendingOrderRequest) =>
      orderActionMutex.runExclusive(async () => {
        await fortunoApi.updatePendingOrder(id, update);
        useTradingStore.getState().updatePendingOrder(id, update);
        await refresh();
      }),
    [refresh],
  );

  const cancelPendingOrder = useCallback(
    async (id: string) =>
      orderActionMutex.runExclusive(async () => {
        await fortunoApi.cancelPendingOrder(id);
        useTradingStore.getState().removePendingOrder(id);
        await refresh();
      }),
    [refresh],
  );

  const cancelAllPendingOrders = useCallback(async () => {
    return orderActionMutex.runExclusive(async () => {
      const current = [...useTradingStore.getState().pendingOrders];
      const errors: string[] = [];
      for (const ord of current) {
        try {
          await fortunoApi.cancelPendingOrder(ord.id);
        } catch (err) {
          errors.push(`#${ord.id}: ${getErrorMessage(err)}`);
        }
      }
      await refresh();
      if (errors.length > 0) {
        throw new Error(`Sebagian order gagal dibatalkan: ${errors.join(', ')}`);
      }
    });
  }, [refresh]);

  return {
    pendingOrders,
    loading,
    error,
    refresh,
    createPendingOrder,
    updatePendingOrder,
    cancelPendingOrder,
    cancelAllPendingOrders,
  };
}
