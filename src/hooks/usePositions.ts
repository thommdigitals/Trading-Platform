'use client';

import { useCallback } from 'react';
import { POLLING } from '@/config/constants';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { OpenPositionRequest, UpdatePositionRequest } from '@/types/api';
import { Mutex } from '@/utils/async';
import { getErrorMessage } from '@/utils/errorHandler';
import { usePolling } from './usePolling';

const tradeActionMutex = new Mutex();

export function usePositions(enablePolling: boolean = true) {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const positions = useTradingStore((s) => s.positions);
  const loading = useTradingStore((s) => s.loading.positions);
  const error = useTradingStore((s) => s.errors.positions ?? null);

  const canFetch = Boolean(apiToken || demoMode);

  const refresh = useCallback(async () => {
    if (!useConfigStore.getState().apiToken && !useConfigStore.getState().demoMode) return;
    const store = useTradingStore.getState();
    if (store.positions.length === 0) store.setLoading('positions', true);
    try {
      const list = await fortunoApi.getPositions();
      store.setPositions(list);
      store.setError('positions', null);
    } catch (err) {
      store.setError('positions', getErrorMessage(err));
    } finally {
      store.setLoading('positions', false);
    }
  }, []);

  usePolling(refresh, POLLING.positionsMs, enablePolling && canFetch);

  const openPosition = useCallback(
    async (request: OpenPositionRequest) =>
      tradeActionMutex.runExclusive(async () => {
        const res = await fortunoApi.openPosition(request);
        await refresh();
        return res;
      }),
    [refresh],
  );

  const closePosition = useCallback(
    async (id: string, volume: number) =>
      tradeActionMutex.runExclusive(async () => {
        await fortunoApi.closePosition(id, volume);
        await refresh();
      }),
    [refresh],
  );

  const updatePosition = useCallback(
    async (id: string, update: UpdatePositionRequest) =>
      tradeActionMutex.runExclusive(async () => {
        await fortunoApi.updatePosition(id, update);
        useTradingStore.getState().updatePosition(id, update);
        await refresh();
      }),
    [refresh],
  );

  const closeAllPositions = useCallback(async () => {
    return tradeActionMutex.runExclusive(async () => {
      const current = [...useTradingStore.getState().positions];
      const errors: string[] = [];
      for (const pos of current) {
        try {
          await fortunoApi.closePosition(pos.id, pos.volume);
        } catch (err) {
          errors.push(`#${pos.id}: ${getErrorMessage(err)}`);
        }
      }
      await refresh();
      if (errors.length > 0) {
        throw new Error(`Sebagian posisi gagal ditutup: ${errors.join(', ')}`);
      }
    });
  }, [refresh]);

  return {
    positions,
    loading,
    error,
    refresh,
    openPosition,
    closePosition,
    updatePosition,
    closeAllPositions,
  };
}

