import type { ZodType } from 'zod';
import { CACHE, RATE_LIMITS } from '@/config/constants';
import {
  CANDLE_PAGE_LIMIT,
  CLOSED_POSITIONS_PAGE_LIMIT,
  DEFAULT_CANDLE_COUNT,
  LEDGER_PAGE_LIMIT,
  MAX_SYMBOLS_PER_REQUEST,
} from '@/config/market';
import { ValidationError } from '@/services/http/errors';
import { HttpClient, type HttpClientOptions } from '@/services/http/httpClient';
import { SlidingWindowRateLimiter } from '@/services/http/rateLimiter';
import {
  AccountSchema,
  AccountSummarySchema,
  CandlesResponseSchema,
  ClosePositionRequestSchema,
  ClosedPositionsResponseSchema,
  CreatePendingOrderRequestSchema,
  CreatePendingOrderResponseSchema,
  EntityIdSchema,
  LedgersResponseSchema,
  OpenPositionRequestSchema,
  OpenPositionResponseSchema,
  PendingOrdersResponseSchema,
  PlatformDetailsSchema,
  PositionsResponseSchema,
  QuotesResponseSchema,
  SymbolNameSchema,
  SymbolsResponseSchema,
  TradingHoursSchema,
  UpdatePendingOrderRequestSchema,
  UpdatePositionRequestSchema,
  type Account,
  type AccountSummary,
  type Candle,
  type CandleInterval,
  type ClosedPosition,
  type CreatePendingOrderRequest,
  type LedgerEntry,
  type OpenPositionRequest,
  type PendingOrder,
  type PlatformDetails,
  type Position,
  type Quote,
  type SymbolInfo,
  type TradingHours,
  type UpdatePendingOrderRequest,
  type UpdatePositionRequest,
} from '@/types/api';
import { TtlCache } from '@/utils/ttlCache';
import { generateIdempotencyKey } from '@/utils/idempotency';

export interface CallOptions {
  signal?: AbortSignal;
}

export interface MutationOptions extends CallOptions {
  /** Provide to make a *user level* retry idempotent; auto-generated otherwise. */
  idempotencyKey?: string;
}

export interface TimeRange {
  from: number;
  to: number;
}

export interface HistoryOptions extends CallOptions {
  symbols?: string[];
  /** Safety valve for the automatic range splitting. */
  maxPages?: number;
  onProgress?: (loaded: number) => void;
}

const DEFAULT_MAX_PAGES = 40;

function validate<T>(schema: ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      `Input ${label} tidak valid`,
      result.error.issues.map((issue) => `${issue.path.join('.') || label}: ${issue.message}`),
    );
  }
  return result.data;
}

const encodeId = (id: string): string => encodeURIComponent(validate(EntityIdSchema, id, 'id'));

function validateSymbols(symbols: readonly string[] | undefined): string[] | undefined {
  if (!symbols || symbols.length === 0) return undefined;
  if (symbols.length > MAX_SYMBOLS_PER_REQUEST) {
    throw new ValidationError(`Maksimal ${MAX_SYMBOLS_PER_REQUEST} simbol per request`);
  }
  return symbols.map((symbol) => validate(SymbolNameSchema, symbol, 'symbol'));
}

/** Typed gateway to the Match-Trader Trader API (all 17 documented endpoints). */
export class FortunoClient {
  private readonly platformCache = new TtlCache<PlatformDetails>({ maxEntries: 2 });
  private readonly accountCache = new TtlCache<Account>({ maxEntries: 2 });
  private readonly symbolCache = new TtlCache<SymbolInfo[]>({ maxEntries: 8 });
  private readonly candleCache = new TtlCache<Candle[]>({ maxEntries: CACHE.maxEntries });
  private readonly hoursCache = new TtlCache<TradingHours>({ maxEntries: CACHE.maxEntries });

  constructor(private readonly http: HttpClient) {}

  /** Drops all cached market & account data (call when switching account / token). */
  clearCaches(): void {
    this.platformCache.clear();
    this.accountCache.clear();
    this.symbolCache.clear();
    this.candleCache.clear();
    this.hoursCache.clear();
  }

  // --- platform & account ---------------------------------------------------------------------

  getPlatformDetails(options: CallOptions & { force?: boolean } = {}): Promise<PlatformDetails> {
    if (options.force) this.platformCache.delete('platform');
    return this.platformCache.getOrLoad(
      'platform',
      () =>
        this.http.request({
          path: '/v1/platform-details',
          schema: PlatformDetailsSchema,
          rateLimitBucket: 'metadata',
          signal: options.signal,
        }),
      CACHE.platformDetailsTtlMs,
    );
  }

  getAccount(options: CallOptions & { force?: boolean } = {}): Promise<Account> {
    if (options.force) this.accountCache.delete('account');
    return this.accountCache.getOrLoad(
      'account',
      () =>
        this.http.request({
          path: '/v1/account',
          schema: AccountSchema,
          rateLimitBucket: 'metadata',
          signal: options.signal,
        }),
      CACHE.accountTtlMs,
    );
  }

  getAccountSummary(options: CallOptions = {}): Promise<AccountSummary> {
    return this.http.request({
      path: '/v1/account-summary',
      schema: AccountSummarySchema,
      rateLimitBucket: 'accountSummary',
      ...options,
    });
  }

  // --- positions ------------------------------------------------------------------------------

  async getPositions(symbols?: string[], options: CallOptions = {}): Promise<Position[]> {
    const response = await this.http.request({
      path: '/v1/positions',
      query: { symbol: validateSymbols(symbols) },
      schema: PositionsResponseSchema,
      ...options,
    });
    return response.positions;
  }

  async openPosition(
    request: OpenPositionRequest,
    options: MutationOptions = {},
  ): Promise<{ positionId: string }> {
    const body = validate(OpenPositionRequestSchema, request, 'order');
    return this.http.request({
      method: 'POST',
      path: '/v1/positions',
      body,
      schema: OpenPositionResponseSchema,
      idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey(),
      rateLimitBucket: 'trading',
      signal: options.signal,
    });
  }

  async updatePosition(id: string, update: UpdatePositionRequest, options: CallOptions = {}): Promise<void> {
    const body = validate(UpdatePositionRequestSchema, update, 'update posisi');
    await this.http.request({
      method: 'PATCH',
      path: `/v1/positions/${encodeId(id)}`,
      body,
      ...options,
    });
  }

  async closePosition(id: string, volume: number, options: MutationOptions = {}): Promise<void> {
    const body = validate(ClosePositionRequestSchema, { volume }, 'volume');
    await this.http.request({
      method: 'POST',
      path: `/v1/positions/${encodeId(id)}/close`,
      body,
      idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey(),
      rateLimitBucket: 'trading',
      signal: options.signal,
    });
  }

  // --- pending orders -------------------------------------------------------------------------

  async getPendingOrders(symbols?: string[], options: CallOptions = {}): Promise<PendingOrder[]> {
    const response = await this.http.request({
      path: '/v1/pending-orders',
      query: { symbol: validateSymbols(symbols) },
      schema: PendingOrdersResponseSchema,
      ...options,
    });
    return response.pendingOrders;
  }

  async createPendingOrder(
    request: CreatePendingOrderRequest,
    options: MutationOptions = {},
  ): Promise<{ orderId: string }> {
    const body = validate(CreatePendingOrderRequestSchema, request, 'pending order');
    return this.http.request({
      method: 'POST',
      path: '/v1/pending-orders',
      body,
      schema: CreatePendingOrderResponseSchema,
      idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey(),
      rateLimitBucket: 'trading',
      signal: options.signal,
    });
  }

  async updatePendingOrder(
    id: string,
    update: UpdatePendingOrderRequest,
    options: CallOptions = {},
  ): Promise<void> {
    const body = validate(UpdatePendingOrderRequestSchema, update, 'update pending order');
    await this.http.request({
      method: 'PATCH',
      path: `/v1/pending-orders/${encodeId(id)}`,
      body,
      ...options,
    });
  }

  async cancelPendingOrder(id: string, options: CallOptions = {}): Promise<void> {
    await this.http.request({
      method: 'DELETE',
      path: `/v1/pending-orders/${encodeId(id)}`,
      ...options,
    });
  }

  // --- market data ----------------------------------------------------------------------------

  /** Symbols change rarely: cached for `CACHE.symbolsTtlMs` and shared between callers. */
  getSymbols(types?: string[], options: CallOptions & { force?: boolean } = {}): Promise<SymbolInfo[]> {
    const key = (types ?? []).slice().sort().join(',') || '*';
    if (options.force) this.symbolCache.delete(key);
    return this.symbolCache.getOrLoad(
      key,
      async () => {
        const response = await this.http.request({
          path: '/v1/symbols',
          query: { type: types },
          schema: SymbolsResponseSchema,
          signal: options.signal,
        });
        return response.symbols;
      },
      CACHE.symbolsTtlMs,
    );
  }

  async getQuotes(symbols: string[], options: CallOptions = {}): Promise<Quote[]> {
    const validated = validateSymbols(symbols);
    if (!validated) throw new ValidationError('Minimal satu simbol diperlukan');
    const response = await this.http.request({
      path: '/v1/quotes',
      query: { symbol: validated },
      schema: QuotesResponseSchema,
      ...options,
    });
    return response.quotes;
  }

  /** Single candle page (max 750). Cached per interval to respect the 20 req/min limit. */
  getCandles(
    symbol: string,
    interval: CandleInterval,
    options: CallOptions & { from?: number; to?: number; limit?: number; force?: boolean } = {},
  ): Promise<Candle[]> {
    const safeSymbol = validate(SymbolNameSchema, symbol, 'symbol');
    const limit = Math.min(options.limit ?? DEFAULT_CANDLE_COUNT, CANDLE_PAGE_LIMIT);
    const key = [safeSymbol, interval, options.from ?? '', options.to ?? '', limit].join('|');
    if (options.force) this.candleCache.delete(key);

    return this.candleCache.getOrLoad(
      key,
      async () => {
        const response = await this.http.request({
          path: '/v1/candles',
          query: { symbol: safeSymbol, interval, from: options.from, to: options.to, limit },
          schema: CandlesResponseSchema,
          rateLimitBucket: 'candles',
          signal: options.signal,
        });
        return response.candles;
      },
      CACHE.candlesTtlMs[interval],
    );
  }

  /** Walks backwards through candle pages to cover `[from, to]` (rate-limiter paces the calls). */
  async getCandlesAll(
    symbol: string,
    interval: CandleInterval,
    range: TimeRange,
    options: CallOptions & { maxPages?: number } = {},
  ): Promise<Candle[]> {
    const collected = new Map<number, Candle>();
    let currentTo = range.to;

    for (let page = 0; page < (options.maxPages ?? DEFAULT_MAX_PAGES); page += 1) {
      const batch = await this.getCandles(symbol, interval, {
        from: range.from,
        to: currentTo,
        limit: CANDLE_PAGE_LIMIT,
        signal: options.signal,
      });
      if (batch.length === 0) break;
      batch.forEach((candle) => collected.set(candle.timestamp, candle));
      if (batch.length < CANDLE_PAGE_LIMIT) break;

      const oldest = Math.min(...batch.map((candle) => candle.timestamp));
      if (oldest <= range.from || oldest - 1 >= currentTo) break;
      currentTo = oldest - 1;
    }
    return [...collected.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  getTradingHours(symbol: string, options: CallOptions = {}): Promise<TradingHours> {
    const safeSymbol = validate(SymbolNameSchema, symbol, 'symbol');
    return this.hoursCache.getOrLoad(
      safeSymbol,
      () =>
        this.http.request({
          path: '/v1/trading-hours',
          query: { symbol: safeSymbol },
          schema: TradingHoursSchema,
          signal: options.signal,
        }),
      CACHE.tradingHoursTtlMs,
    );
  }

  // --- history --------------------------------------------------------------------------------

  async getClosedPositions(
    range: TimeRange,
    options: CallOptions & { limit?: number; symbols?: string[] } = {},
  ): Promise<ClosedPosition[]> {
    const response = await this.http.request({
      path: '/v1/closed-positions',
      query: {
        from: range.from,
        to: range.to,
        limit: Math.min(options.limit ?? 100, CLOSED_POSITIONS_PAGE_LIMIT),
        symbol: validateSymbols(options.symbols),
      },
      schema: ClosedPositionsResponseSchema,
      signal: options.signal,
    });
    return response.positions;
  }

  /** Fetches every closed position in the range, splitting it into pages of 500. */
  async getClosedPositionsAll(range: TimeRange, options: HistoryOptions = {}): Promise<ClosedPosition[]> {
    const seen = new Map<string, ClosedPosition>();
    let currentTo = range.to;

    for (let page = 0; page < (options.maxPages ?? DEFAULT_MAX_PAGES); page += 1) {
      const batch = await this.getClosedPositions(
        { from: range.from, to: currentTo },
        { limit: CLOSED_POSITIONS_PAGE_LIMIT, symbols: options.symbols, signal: options.signal },
      );
      const before = seen.size;
      batch.forEach((position) => seen.set(position.id, position));
      options.onProgress?.(seen.size);

      if (batch.length < CLOSED_POSITIONS_PAGE_LIMIT) break;
      const oldest = Math.min(...batch.map((position) => position.closeTime));
      // keep ties at the boundary; only step past it when a page brought nothing new
      currentTo = seen.size === before ? oldest - 1 : oldest;
      if (currentTo <= range.from) break;
    }
    return [...seen.values()].sort((a, b) => b.closeTime - a.closeTime);
  }

  async getLedgers(
    range: TimeRange,
    options: CallOptions & { limit?: number; types?: string[] } = {},
  ): Promise<LedgerEntry[]> {
    const response = await this.http.request({
      path: '/v1/ledgers',
      query: {
        from: range.from,
        to: range.to,
        limit: Math.min(options.limit ?? 100, LEDGER_PAGE_LIMIT),
        type: options.types,
      },
      schema: LedgersResponseSchema,
      signal: options.signal,
    });
    return response.ledger;
  }

  async getLedgersAll(
    range: TimeRange,
    options: HistoryOptions & { types?: string[] } = {},
  ): Promise<LedgerEntry[]> {
    const seen = new Map<string, LedgerEntry>();
    let currentTo = range.to;

    for (let page = 0; page < (options.maxPages ?? DEFAULT_MAX_PAGES); page += 1) {
      const batch = await this.getLedgers(
        { from: range.from, to: currentTo },
        { limit: LEDGER_PAGE_LIMIT, types: options.types, signal: options.signal },
      );
      const before = seen.size;
      batch.forEach((entry) => seen.set(entry.id, entry));
      options.onProgress?.(seen.size);

      if (batch.length < LEDGER_PAGE_LIMIT) break;
      const oldest = Math.min(...batch.map((entry) => entry.time));
      currentTo = seen.size === before ? oldest - 1 : oldest;
      if (currentTo <= range.from) break;
    }
    return [...seen.values()].sort((a, b) => b.time - a.time);
  }
}

export interface CreateClientOptions extends Omit<HttpClientOptions, 'rateLimiter'> {
  rateLimiter?: SlidingWindowRateLimiter;
}

export function createFortunoClient(options: CreateClientOptions): FortunoClient {
  const rateLimiter =
    options.rateLimiter ??
    new SlidingWindowRateLimiter(
      {
        trading: RATE_LIMITS.trading,
        candles: RATE_LIMITS.candles,
        quotes: RATE_LIMITS.quotes,
        accountSummary: RATE_LIMITS.accountSummary,
        positions: RATE_LIMITS.positions,
        pendingOrders: RATE_LIMITS.pendingOrders,
        metadata: RATE_LIMITS.metadata,
      },
      { maxWaitMs: RATE_LIMITS.maxQueueWaitMs },
    );
  return new FortunoClient(new HttpClient({ ...options, rateLimiter }));
}

