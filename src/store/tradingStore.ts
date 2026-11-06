import { create } from 'zustand';
import type {
  Account,
  AccountSummary,
  Candle,
  CandleInterval,
  PendingOrder,
  PlatformDetails,
  Position,
  Quote,
  SymbolInfo,
  TradingHours,
} from '@/types/api';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface CandleSlice {
  candles: Candle[];
  interval: CandleInterval;
  lastFetched: number;
}

export interface LoadingFlags {
  account: boolean;
  positions: boolean;
  pendingOrders: boolean;
  symbols: boolean;
  quotes: boolean;
  candles: boolean;
}

export interface TradingState {
  connectionState: ConnectionState;
  isConnected: boolean;
  connectionError: string | null;
  rateLimitRemaining: { endpoint: number | null; global: number | null };

  platformDetails: PlatformDetails | null;
  account: Account | null;
  accountSummary: AccountSummary | null;

  positions: Position[];
  pendingOrders: PendingOrder[];
  symbols: SymbolInfo[];
  quotes: Record<string, Quote>;
  previousQuotes: Record<string, Quote>;
  candles: Record<string, CandleSlice>;
  tradingHours: Record<string, TradingHours>;

  loading: LoadingFlags;
  errors: Record<string, string | null>;

  setConnectionState: (state: ConnectionState, error?: string | null) => void;
  setConnected: (isConnected: boolean, error?: string | null) => void;
  setRateLimitRemaining: (info: { endpoint: number | null; global: number | null }) => void;
  setPlatformDetails: (details: PlatformDetails | null) => void;
  setAccount: (account: Account | null) => void;
  setAccountSummary: (summary: AccountSummary | null) => void;
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, update: Partial<Position>) => void;
  removePosition: (id: string) => void;
  setPendingOrders: (orders: PendingOrder[]) => void;
  addPendingOrder: (order: PendingOrder) => void;
  updatePendingOrder: (id: string, update: Partial<PendingOrder>) => void;
  removePendingOrder: (id: string) => void;
  setSymbols: (symbols: SymbolInfo[]) => void;
  setQuote: (symbol: string, quote: Quote) => void;
  setQuotes: (quotes: Quote[]) => void;
  setCandles: (symbol: string, interval: CandleInterval, candles: Candle[]) => void;
  appendCandle: (symbol: string, interval: CandleInterval, candle: Candle) => void;
  setTradingHours: (symbol: string, hours: TradingHours) => void;
  setLoading: (key: keyof LoadingFlags, value: boolean) => void;
  setError: (key: string, message: string | null) => void;
  reset: () => void;
}

const initialLoading: LoadingFlags = {
  account: false,
  positions: false,
  pendingOrders: false,
  symbols: false,
  quotes: false,
  candles: false,
};

export const candleKey = (symbol: string, interval: CandleInterval): string =>
  `${symbol.toUpperCase()}_${interval}`;

/** Recomputes live position currentPrice & floating profit when a new quote arrives. */
function applyQuotesToPositions(
  positions: readonly Position[],
  quotes: Record<string, Quote>,
  symbols: readonly SymbolInfo[],
): Position[] {
  if (positions.length === 0) return positions as Position[];
  const symbolMap = new Map(symbols.map((s) => [s.symbol, s]));
  let mutated = false;
  const next = positions.map((pos) => {
    const quote = quotes[pos.symbol];
    if (!quote) return pos;
    const mark = pos.side === 'BUY' ? quote.bid : quote.ask;
    if (pos.currentPrice === mark) return pos;
    mutated = true;
    const contractSize = symbolMap.get(pos.symbol)?.contractSize ?? 100_000;
    const diff = pos.side === 'BUY' ? mark - pos.openPrice : pos.openPrice - mark;
    const profit =
      pos.currentPrice !== null && pos.currentPrice !== pos.openPrice
        ? pos.profit + (pos.side === 'BUY' ? mark - pos.currentPrice : pos.currentPrice - mark) * pos.volume * contractSize
        : diff * pos.volume * contractSize;
    return { ...pos, currentPrice: mark, profit: Number(profit.toFixed(2)) };
  });
  return mutated ? next : (positions as Position[]);
}

export const useTradingStore = create<TradingState>((set, get) => ({
  connectionState: 'disconnected',
  isConnected: false,
  connectionError: null,
  rateLimitRemaining: { endpoint: null, global: null },

  platformDetails: null,
  account: null,
  accountSummary: null,

  positions: [],
  pendingOrders: [],
  symbols: [],
  quotes: {},
  previousQuotes: {},
  candles: {},
  tradingHours: {},

  loading: { ...initialLoading },
  errors: {},

  setConnectionState(connectionState, error = null) {
    set({
      connectionState,
      isConnected: connectionState === 'connected',
      connectionError: error,
    });
  },

  setConnected(isConnected, error = null) {
    set({
      isConnected,
      connectionState: isConnected ? 'connected' : 'disconnected',
      connectionError: error,
    });
  },

  setRateLimitRemaining(rateLimitRemaining) {
    set({ rateLimitRemaining });
  },

  setPlatformDetails(platformDetails) {
    set({ platformDetails });
  },

  setAccount(account) {
    set({ account });
  },

  setAccountSummary(accountSummary) {
    set({ accountSummary });
  },

  setPositions(positions) {
    set({ positions });
  },

  addPosition(position) {
    set({ positions: [position, ...get().positions.filter((p) => p.id !== position.id)] });
  },

  updatePosition(id, update) {
    set({
      positions: get().positions.map((pos) => (pos.id === id ? { ...pos, ...update } : pos)),
    });
  },

  removePosition(id) {
    set({ positions: get().positions.filter((pos) => pos.id !== id) });
  },

  setPendingOrders(pendingOrders) {
    set({ pendingOrders });
  },

  addPendingOrder(order) {
    set({
      pendingOrders: [order, ...get().pendingOrders.filter((o) => o.id !== order.id)],
    });
  },

  updatePendingOrder(id, update) {
    set({
      pendingOrders: get().pendingOrders.map((order) =>
        order.id === id ? { ...order, ...update } : order,
      ),
    });
  },

  removePendingOrder(id) {
    set({ pendingOrders: get().pendingOrders.filter((order) => order.id !== id) });
  },

  setSymbols(symbols) {
    set({ symbols });
  },

  setQuote(symbol, quote) {
    const prev = get().quotes[symbol];
    const nextQuotes = { ...get().quotes, [symbol]: quote };
    const nextPrev = prev ? { ...get().previousQuotes, [symbol]: prev } : get().previousQuotes;
    set({
      quotes: nextQuotes,
      previousQuotes: nextPrev,
      positions: applyQuotesToPositions(get().positions, nextQuotes, get().symbols),
    });
  },

  setQuotes(quotesList) {
    if (quotesList.length === 0) return;
    const currentQuotes = get().quotes;
    const nextQuotes = { ...currentQuotes };
    const nextPrev = { ...get().previousQuotes };
    let changed = false;

    for (const quote of quotesList) {
      const existing = currentQuotes[quote.symbol];
      if (existing && existing.bid === quote.bid && existing.ask === quote.ask) continue;
      if (existing) nextPrev[quote.symbol] = existing;
      nextQuotes[quote.symbol] = quote;
      changed = true;
    }
    if (!changed) return;

    set({
      quotes: nextQuotes,
      previousQuotes: nextPrev,
      positions: applyQuotesToPositions(get().positions, nextQuotes, get().symbols),
    });
  },

  setCandles(symbol, interval, candles) {
    const key = candleKey(symbol, interval);
    set({
      candles: {
        ...get().candles,
        [key]: { candles, interval, lastFetched: Date.now() },
      },
    });
  },

  appendCandle(symbol, interval, candle) {
    const key = candleKey(symbol, interval);
    const slice = get().candles[key];
    const existing = slice?.candles ?? [];
    const last = existing[existing.length - 1];
    const nextCandles =
      last && last.timestamp === candle.timestamp
        ? [...existing.slice(0, -1), candle]
        : [...existing, candle];
    set({
      candles: {
        ...get().candles,
        [key]: { candles: nextCandles, interval, lastFetched: Date.now() },
      },
    });
  },

  setTradingHours(symbol, hours) {
    set({ tradingHours: { ...get().tradingHours, [symbol]: hours } });
  },

  setLoading(key, value) {
    if (get().loading[key] === value) return;
    set({ loading: { ...get().loading, [key]: value } });
  },

  setError(key, message) {
    set({ errors: { ...get().errors, [key]: message } });
  },

  reset() {
    set({
      connectionState: 'disconnected',
      isConnected: false,
      connectionError: null,
      rateLimitRemaining: { endpoint: null, global: null },
      platformDetails: null,
      account: null,
      accountSummary: null,
      positions: [],
      pendingOrders: [],
      quotes: {},
      previousQuotes: {},
      candles: {},
      tradingHours: {},
      loading: { ...initialLoading },
      errors: {},
    });
  },
}));

