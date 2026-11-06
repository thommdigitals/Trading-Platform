import { env } from '@/config/env';
import { createFortunoClient, FortunoClient } from '@/services/fortuno/client';
import { demoFetch } from '@/services/fortuno/demoBackend';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

export { FortunoClient, createFortunoClient };
export type {
  CallOptions,
  CreateClientOptions,
  HistoryOptions,
  MutationOptions,
  TimeRange,
} from '@/services/fortuno/client';

/**
 * Application-wide Fortuno API client instance.
 * Reads the current JWT token from `useConfigStore` on every call, routes to the in-memory Demo
 * Sandbox when `demoMode` is enabled, and notifies `useTradingStore` on rate-limit headers or 401.
 */
export const fortunoApi: FortunoClient = createFortunoClient({
  baseUrl: env.fortunoApiBase,
  getAuthToken: () => {
    const { apiToken, demoMode } = useConfigStore.getState();
    if (demoMode && !apiToken) return 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjQxMDI0NDQ4MDB9.demo';
    return apiToken;
  },
  fetchImpl: (input, init) => {
    if (useConfigStore.getState().demoMode) {
      return demoFetch(input, init);
    }
    return fetch(input, init);
  },
  onUnauthorized: () => {
    useConfigStore.getState().logout();
    useTradingStore.getState().reset();
  },
  onRateLimitInfo: (info) => {
    useTradingStore.getState().setRateLimitRemaining(info);
  },
});
