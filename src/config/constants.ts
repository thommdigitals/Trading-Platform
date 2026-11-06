/**
 * Central, tweakable runtime constants. Change values here, never inline them.
 */

export const POLLING = {
  quotesMs: 1_000,
  positionsMs: 3_000,
  accountMs: 5_000,
  pendingOrdersMs: 5_000,
  /** Random +/- jitter to avoid synchronised request bursts. */
  jitterMs: 200,
  /** Max backoff multiplier applied after consecutive polling failures. */
  maxBackoffFactor: 8,
} as const;

export const HTTP = {
  timeoutMs: 10_000,
  /** Timeout for AI provider calls (LLMs are slow). */
  aiTimeoutMs: 60_000,
} as const;

export const RETRY = {
  /** Retries after the first attempt (so up to `maxRetries + 1` attempts in total). */
  maxRetries: 3,
  baseDelayMs: 2_000,
  maxDelayMs: 30_000,
  serviceUnavailableDelayMs: 5_000,
  idempotencyInProgressDelayMs: 2_000,
} as const;

/** Client side budgets mirroring the broker rate limits (requests per window). */
export const RATE_LIMITS = {
  trading: { limit: 60, windowMs: 60_000 },
  candles: { limit: 20, windowMs: 60_000 },
  /** Longest a request may wait for a free slot before failing fast. */
  maxQueueWaitMs: 15_000,
  /** Warn the user when remaining endpoint budget gets this low. */
  warnRemaining: 5,
} as const;

export const CACHE = {
  symbolsTtlMs: 5 * 60_000,
  tradingHoursTtlMs: 10 * 60_000,
  /** Cache lifetime of candle responses, by interval (ms). Keeps us below 20 req/min. */
  candlesTtlMs: {
    M1: 15_000,
    M5: 30_000,
    M15: 60_000,
    M30: 90_000,
    H1: 120_000,
    H4: 300_000,
    D1: 600_000,
    W1: 900_000,
    MN1: 900_000,
  },
  maxEntries: 200,
} as const;

export const TOKEN = {
  expiryWarningDays: 7,
} as const;

export const CHAT = {
  maxMessages: 100,
  maxInputChars: 4_000,
  maxContextPositions: 30,
  maxContextOrders: 30,
  /** Rough char budget for the trading context injected in the system prompt. */
  maxContextChars: 8_000,
} as const;

export const AI = {
  defaultTemperature: 0.4,
  defaultMaxTokens: 1_500,
  /** Minimum gap between queued AI requests (provider rate-limit protection). */
  queueMinGapMs: 1_000,
  queueConcurrency: 1,
  analysisCandleCount: 200,
  maxMultiSymbols: 10,
  maxToolRounds: 4,
  maxTradingToolVolume: 100,
} as const;

export const AUTOMATION = {
  minEvaluationIntervalMs: 15_000,
  circuitBreakerMaxErrors: 3,
  maxLogEntries: 100,
  candlesPerEvaluation: 120,
} as const;

export const UI = {
  maxTableRows: 500,
  toastDurationMs: 5_000,
  quoteFlashMs: 400,
  mobileBreakpointPx: 768,
} as const;

export const STORAGE_KEYS = {
  token: 'fortuno.token',
  aiProviders: 'fortuno.ai.providers',
  prefs: 'fortuno.prefs',
  encryptionDb: 'fortuno-secure',
  chat: 'fortuno.ai.chat',
} as const;
