/**
 * Market related constants shared by config, types and services.
 * Kept dependency-free so it can be imported anywhere (including zod schemas).
 */

export const CANDLE_INTERVALS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Nominal duration of one candle per interval (month approximated as 30 days). */
export const CANDLE_INTERVAL_MS: Record<CandleInterval, number> = {
  M1: MINUTE,
  M5: 5 * MINUTE,
  M15: 15 * MINUTE,
  M30: 30 * MINUTE,
  H1: HOUR,
  H4: 4 * HOUR,
  D1: DAY,
  W1: 7 * DAY,
  MN1: 30 * DAY,
};

export const DEFAULT_CANDLE_INTERVAL: CandleInterval = 'H1';
export const DEFAULT_SYMBOL = 'EURUSD';
export const DEFAULT_WATCHLIST: readonly string[] = ['EURUSD', 'GBPUSD', 'XAUUSD'];

/** API hard limits (documented by Match-Trader). */
export const CANDLE_PAGE_LIMIT = 750;
export const CLOSED_POSITIONS_PAGE_LIMIT = 500;
export const LEDGER_PAGE_LIMIT = 500;
export const DEFAULT_CANDLE_COUNT = 200;

/** Input hygiene limits (defence in depth; the broker validates again). */
export const COMMENT_MAX_LENGTH = 128;
export const SYMBOL_PATTERN = /^[A-Za-z0-9._#@-]{1,32}$/;
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_SYMBOLS_PER_REQUEST = 50;

export const POSITION_SIDES = ['BUY', 'SELL'] as const;
export const PENDING_ORDER_TYPES = ['LIMIT', 'STOP'] as const;
export const ACCESS_RIGHTS = [
  'FULL',
  'CLOSE_ONLY',
  'TRADING_DISABLED',
  'ACCESS_DISABLED',
] as const;
export const LEDGER_TYPES = [
  'DEPOSIT',
  'WITHDRAWAL',
  'COMMISSION',
  'SWAP',
  'CREDIT',
  'BONUS',
  'ADJUSTMENT',
] as const;
