import { beforeEach, describe, expect, it } from 'vitest';
import { generateEncryptionKey } from '@/utils/encryption';
import { SecureStorage, type StorageBackend } from '@/services/storage';
import { useConfigStore } from './configStore';
import { useTradingStore, candleKey } from './tradingStore';
import { useAIStore } from './aiStore';
import { fortunoApi } from '@/services/fortunoApi';

class MemoryBackend implements StorageBackend {
  private readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

async function createMemoryStorages() {
  const key = await generateEncryptionKey();
  const persistentBackend = new MemoryBackend();
  const sessionBackend = new MemoryBackend();
  return {
    persistent: new SecureStorage({
      backend: () => persistentBackend,
      getKey: async () => key,
    }),
    session: new SecureStorage({
      backend: () => sessionBackend,
      getKey: async () => key,
    }),
  };
}

describe('configStore', () => {
  beforeEach(async () => {
    const storages = await createMemoryStorages();
    await useConfigStore.getState().hydrate(storages);
  });

  it('seeds default AI providers and persists token in encrypted storage', async () => {
    const storages = await createMemoryStorages();
    await useConfigStore.getState().hydrate(storages);
    expect(useConfigStore.getState().aiProviders.length).toBeGreaterThanOrEqual(6);

    await useConfigStore.getState().setToken('aaa.bbb.ccc', true);
    expect(useConfigStore.getState().apiToken).toBe('aaa.bbb.ccc');

    // Hydrate into a fresh check from the same storages
    useConfigStore.setState({ apiToken: null });
    await useConfigStore.getState().hydrate(storages);
    expect(useConfigStore.getState().apiToken).toBe('aaa.bbb.ccc');
  });

  it('manages AI providers and switches active provider when deleted', () => {
    const added = useConfigStore.getState().addProvider({
      displayName: 'DeepSeek Custom',
      type: 'custom',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-1234',
      defaultModel: 'deepseek-chat',
    });
    useConfigStore.getState().setActiveProvider(added.id);
    expect(useConfigStore.getState().activeProviderId).toBe(added.id);

    useConfigStore.getState().updateProvider(added.id, { displayName: 'DeepSeek V3' });
    expect(useConfigStore.getState().aiProviders.find((p) => p.id === added.id)?.displayName).toBe(
      'DeepSeek V3',
    );

    useConfigStore.getState().removeProvider(added.id);
    expect(useConfigStore.getState().activeProviderId).not.toBe(added.id);
    expect(useConfigStore.getState().activeProviderId).toBeTruthy();
  });

  it('manages watchlist, theme, fontSize and riskSettings', () => {
    useConfigStore.getState().addToWatchlist('usdjpy');
    expect(useConfigStore.getState().watchlist).toContain('USDJPY');

    useConfigStore.getState().reorderWatchlist(0, 2);
    useConfigStore.getState().removeFromWatchlist('USDJPY');
    expect(useConfigStore.getState().watchlist).not.toContain('USDJPY');

    useConfigStore.getState().toggleTheme();
    expect(useConfigStore.getState().theme).toBe('light');

    useConfigStore.getState().setFontSize('lg');
    expect(useConfigStore.getState().fontSize).toBe('lg');

    useConfigStore.getState().updateRiskSettings({ maxLotWarning: 2.5 });
    expect(useConfigStore.getState().riskSettings.maxLotWarning).toBe(2.5);
  });
});

describe('tradingStore', () => {
  beforeEach(() => {
    useTradingStore.getState().reset();
  });

  it('updates positions and recomputes live P&L when quotes arrive', () => {
    useTradingStore.getState().setSymbols([
      {
        symbol: 'EURUSD',
        alias: 'EUR/USD',
        pricePrecision: 5,
        volumeMin: 0.01,
        volumeMax: 100,
        volumeStep: 0.01,
        contractSize: 100_000,
        swapLong: null,
        swapShort: null,
        marginRequired: null,
        sessionOpen: true,
        type: 'FOREX',
      },
    ]);
    useTradingStore.getState().setPositions([
      {
        id: '10',
        symbol: 'EURUSD',
        alias: 'EUR/USD',
        side: 'BUY',
        volume: 0.1,
        openPrice: 1.08,
        currentPrice: 1.08,
        openTime: 1000,
        tpPrice: null,
        slPrice: null,
        swap: 0,
        commission: 0,
        profit: 0,
        comment: '',
      },
    ]);

    useTradingStore
      .getState()
      .setQuotes([{ symbol: 'EURUSD', bid: 1.081, ask: 1.0812, timestamp: 2000 }]);
    const updated = useTradingStore.getState().positions[0]!;
    expect(updated.currentPrice).toBe(1.081);
    expect(updated.profit).toBeCloseTo(10, 2);
  });

  it('appends and replaces last candle by timestamp', () => {
    useTradingStore.getState().setCandles('EURUSD', 'H1', [
      { timestamp: 1000, open: 1, high: 1.1, low: 0.9, close: 1.05, tickCount: 10 },
    ]);
    useTradingStore.getState().appendCandle('EURUSD', 'H1', {
      timestamp: 1000,
      open: 1,
      high: 1.2,
      low: 0.9,
      close: 1.15,
      tickCount: 20,
    });
    expect(useTradingStore.getState().candles[candleKey('EURUSD', 'H1')]?.candles).toHaveLength(1);
    expect(
      useTradingStore.getState().candles[candleKey('EURUSD', 'H1')]?.candles[0]?.close,
    ).toBe(1.15);

    useTradingStore.getState().appendCandle('EURUSD', 'H1', {
      timestamp: 2000,
      open: 1.15,
      high: 1.2,
      low: 1.1,
      close: 1.18,
      tickCount: 5,
    });
    expect(useTradingStore.getState().candles[candleKey('EURUSD', 'H1')]?.candles).toHaveLength(2);
  });
});

describe('aiStore', () => {
  beforeEach(() => {
    useAIStore.getState().clearMessages();
    useAIStore.getState().clearAutomationLog();
  });

  it('adds messages with sliding window and manages automation logs', () => {
    const msg = useAIStore.getState().addMessage({ role: 'user', content: 'Analisis EURUSD' });
    expect(msg.id).toBeTruthy();
    expect(useAIStore.getState().chatMessages).toHaveLength(1);

    useAIStore.getState().addAutomationLog({ level: 'info', message: 'Started' });
    expect(useAIStore.getState().automationLog[0]?.message).toBe('Started');
  });
});

describe('fortunoApi with Demo Sandbox', () => {
  it('executes all 17 endpoints end-to-end in demo mode', async () => {
    useConfigStore.getState().setDemoMode(true);
    fortunoApi.clearCaches();

    const details = await fortunoApi.getPlatformDetails();
    expect(details.brokerName).toContain('Fortuno');

    const account = await fortunoApi.getAccount();
    expect(account.currency).toBe('USD');

    const summary = await fortunoApi.getAccountSummary();
    expect(summary.balance).toBeGreaterThan(0);

    const symbols = await fortunoApi.getSymbols();
    expect(symbols.length).toBeGreaterThan(0);

    const quotes = await fortunoApi.getQuotes(['EURUSD', 'XAUUSD']);
    expect(quotes).toHaveLength(2);

    const candles = await fortunoApi.getCandles('EURUSD', 'H1', { limit: 50 });
    expect(candles).toHaveLength(50);

    const hours = await fortunoApi.getTradingHours('EURUSD');
    expect(hours.symbol).toBe('EURUSD');

    const opened = await fortunoApi.openPosition({
      symbol: 'EURUSD',
      side: 'BUY',
      volume: 0.05,
      comment: 'Test demo',
    });
    expect(opened.positionId).toBeTruthy();

    await fortunoApi.updatePosition(opened.positionId, { tpPrice: 1.12, slPrice: null });
    const positions = await fortunoApi.getPositions();
    expect(positions.some((p) => p.id === opened.positionId && p.tpPrice === 1.12)).toBe(true);

    await fortunoApi.closePosition(opened.positionId, 0.05);

    const createdOrder = await fortunoApi.createPendingOrder({
      symbol: 'EURUSD',
      side: 'BUY',
      type: 'LIMIT',
      volume: 0.05,
      activationPrice: 1.07,
    });
    await fortunoApi.updatePendingOrder(createdOrder.orderId, { activationPrice: 1.069 });
    const orders = await fortunoApi.getPendingOrders();
    expect(orders.some((o) => o.id === createdOrder.orderId)).toBe(true);
    await fortunoApi.cancelPendingOrder(createdOrder.orderId);

    const closed = await fortunoApi.getClosedPositions({ from: 0, to: Date.now() + 10_000 });
    expect(closed.length).toBeGreaterThan(0);

    const ledgers = await fortunoApi.getLedgers({ from: 0, to: Date.now() + 10_000 });
    expect(ledgers.length).toBeGreaterThan(0);

    useConfigStore.getState().setDemoMode(false);
  });
});
