import { z } from 'zod';
import {
  ACCESS_RIGHTS,
  CANDLE_INTERVALS,
  COMMENT_MAX_LENGTH,
  ID_PATTERN,
  PENDING_ORDER_TYPES,
  POSITION_SIDES,
  SYMBOL_PATTERN,
} from '@/config/market';

/**
 * Match-Trader Trader API contracts.
 * Response schemas are intentionally lenient on optional/unknown fields, strict on the ones the
 * UI depends on, and double as runtime validation of untrusted network data.
 */

// --- primitives -------------------------------------------------------------------------------

const idSchema = z.union([z.string(), z.number()]).transform((value) => String(value));
const optionalPrice = z
  .number()
  .nullish()
  .transform((value) => value ?? null);
const text = z
  .string()
  .nullish()
  .transform((value) => value ?? '');
const finiteNumber = z.number().finite();

export const SideSchema = z.enum(POSITION_SIDES);
export type Side = z.infer<typeof SideSchema>;
export const PendingOrderTypeSchema = z.enum(PENDING_ORDER_TYPES);
export type PendingOrderType = z.infer<typeof PendingOrderTypeSchema>;
export const CandleIntervalSchema = z.enum(CANDLE_INTERVALS);
export type CandleInterval = z.infer<typeof CandleIntervalSchema>;
export const AccessRightSchema = z.enum(ACCESS_RIGHTS);
export type AccessRight = z.infer<typeof AccessRightSchema>;

// --- responses --------------------------------------------------------------------------------

export const PlatformDetailsSchema = z.object({
  brokerName: z.string(),
  platformUrl: z.string().nullish().transform((v) => v ?? ''),
});
export type PlatformDetails = z.infer<typeof PlatformDetailsSchema>;

export const AccountSchema = z
  .object({
    login: z.union([z.number(), z.string()]).transform(String),
    name: text,
    firstName: text,
    lastName: text,
    email: text,
    currency: z.string(),
    currencyPrecision: z.number().int().min(0).max(8).catch(2),
    leverage: z.number().catch(1),
    /** Unknown values fail closed (trading disabled) rather than open. */
    accessRight: AccessRightSchema.catch('TRADING_DISABLED'),
  })
  .transform((val) => ({
    login: val.login,
    name:
      val.name ||
      [val.firstName, val.lastName].filter(Boolean).join(' ').trim() ||
      val.email ||
      '',
    currency: val.currency,
    currencyPrecision: val.currencyPrecision,
    leverage: val.leverage,
    accessRight: val.accessRight,
  }));
export type Account = z.infer<typeof AccountSchema>;

export const AccountSummarySchema = z
  .object({
    balance: finiteNumber,
    equity: finiteNumber,
    margin: finiteNumber.optional(),
    freeMargin: finiteNumber.optional(),
    freeFunds: finiteNumber.optional(),
    marginLevel: z.number().nullish(),
    floatingProfit: finiteNumber.optional(),
    profit: finiteNumber.optional(),
    credit: finiteNumber.optional(),
  })
  .transform((val) => ({
    balance: val.balance,
    equity: val.equity,
    margin: val.margin ?? 0,
    freeMargin: val.freeMargin ?? val.freeFunds ?? 0,
    marginLevel: val.marginLevel ?? null,
    floatingProfit: val.floatingProfit ?? val.profit ?? 0,
  }));
export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const PositionSchema = z.object({
  id: idSchema,
  symbol: z.string(),
  alias: text,
  side: SideSchema,
  volume: finiteNumber,
  openPrice: finiteNumber,
  currentPrice: optionalPrice,
  openTime: finiteNumber,
  tpPrice: optionalPrice,
  slPrice: optionalPrice,
  swap: finiteNumber.catch(0),
  commission: finiteNumber.catch(0),
  profit: finiteNumber.catch(0),
  comment: text,
});
export type Position = z.infer<typeof PositionSchema>;

export const ClosedPositionSchema = PositionSchema.extend({
  closePrice: finiteNumber,
  closeTime: finiteNumber,
});
export type ClosedPosition = z.infer<typeof ClosedPositionSchema>;

export const PendingOrderSchema = z.object({
  id: idSchema,
  symbol: z.string(),
  alias: text,
  type: PendingOrderTypeSchema,
  side: SideSchema,
  volume: finiteNumber,
  activationPrice: finiteNumber,
  tpPrice: optionalPrice,
  slPrice: optionalPrice,
  createTime: finiteNumber,
  comment: text,
});
export type PendingOrder = z.infer<typeof PendingOrderSchema>;

export const SymbolInfoSchema = z
  .object({
    symbol: z.string(),
    alias: text,
    pricePrecision: z.number().int().min(0).max(10),
    volumeMin: finiteNumber,
    volumeMax: finiteNumber,
    volumeStep: finiteNumber.positive(),
    contractSize: finiteNumber.catch(1),
    swapLong: z.number().nullish(),
    swapShort: z.number().nullish(),
    buySwap: z.number().nullish(),
    sellSwap: z.number().nullish(),
    marginRequired: z.number().nullish().transform((v) => v ?? null),
    sessionOpen: z.boolean().nullish().transform((v) => v ?? null),
    type: z.string().nullish().transform((v) => v ?? null),
  })
  .transform((val) => ({
    symbol: val.symbol,
    alias: val.alias,
    pricePrecision: val.pricePrecision,
    volumeMin: val.volumeMin,
    volumeMax: val.volumeMax,
    volumeStep: val.volumeStep,
    contractSize: val.contractSize,
    swapLong: val.swapLong ?? val.buySwap ?? null,
    swapShort: val.swapShort ?? val.sellSwap ?? null,
    marginRequired: val.marginRequired,
    sessionOpen: val.sessionOpen,
    type: val.type,
  }));
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;

export const QuoteSchema = z.object({
  symbol: z.string(),
  bid: finiteNumber,
  ask: finiteNumber,
  timestamp: finiteNumber.catch(() => Date.now()),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const CandleSchema = z.object({
  timestamp: finiteNumber,
  open: finiteNumber,
  high: finiteNumber,
  low: finiteNumber,
  close: finiteNumber,
  tickCount: finiteNumber.catch(0),
});
export type Candle = z.infer<typeof CandleSchema>;

const DAY_NAMES: Record<number, string> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
  7: 'SUNDAY',
};

export const TradingSessionSchema = z.object({
  dayOfWeek: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === 'number' ? (DAY_NAMES[v] ?? `DAY_${v}`) : v,
  ),
  open: z.string(),
  close: z.string(),
});
export type TradingSession = z.infer<typeof TradingSessionSchema>;

const SingleTradingHoursSchema = z.object({
  symbol: z.string(),
  sessions: z.array(TradingSessionSchema).catch([]),
  isCurrentlyOpen: z.boolean().nullish().transform((v) => v ?? null),
});

export const TradingHoursSchema = z
  .union([
    SingleTradingHoursSchema,
    z
      .object({
        tradingHours: z.array(SingleTradingHoursSchema),
      })
      .transform(
        (val) =>
          val.tradingHours[0] ?? {
            symbol: '',
            sessions: [],
            isCurrentlyOpen: null,
          },
      ),
  ]);
export type TradingHours = z.infer<typeof TradingHoursSchema>;

export const LedgerEntrySchema = z
  .object({
    id: idSchema,
    type: z.string(),
    amount: finiteNumber,
    balanceAfter: z.number().nullish().transform((v) => v ?? null),
    time: finiteNumber.optional(),
    timestamp: finiteNumber.optional(),
    comment: text,
  })
  .transform((val) => ({
    id: val.id,
    type: val.type,
    amount: val.amount,
    balanceAfter: val.balanceAfter,
    time: val.time ?? val.timestamp ?? Date.now(),
    comment: val.comment,
  }));
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// --- response envelopes -----------------------------------------------------------------------

export const PositionsResponseSchema = z.object({ positions: z.array(PositionSchema) });
export const ClosedPositionsResponseSchema = z
  .object({
    positions: z.array(ClosedPositionSchema).optional(),
    closedPositions: z.array(ClosedPositionSchema).optional(),
  })
  .transform((value) => ({ positions: value.positions ?? value.closedPositions ?? [] }));
export const PendingOrdersResponseSchema = z.object({ pendingOrders: z.array(PendingOrderSchema) });
export const SymbolsResponseSchema = z.object({ symbols: z.array(SymbolInfoSchema) });
export const QuotesResponseSchema = z.object({ quotes: z.array(QuoteSchema) });
export const CandlesResponseSchema = z.object({
  symbol: z.string().optional(),
  interval: z.string().optional(),
  candles: z.array(CandleSchema),
});
export type CandlesResponse = z.infer<typeof CandlesResponseSchema>;
export const LedgersResponseSchema = z
  .object({
    ledger: z.array(LedgerEntrySchema).optional(),
    ledgers: z.array(LedgerEntrySchema).optional(),
  })
  .transform((value) => ({ ledger: value.ledger ?? value.ledgers ?? [] }));
export const OpenPositionResponseSchema = z.object({ positionId: idSchema });
export const CreatePendingOrderResponseSchema = z.object({ orderId: idSchema });

// --- requests ---------------------------------------------------------------------------------

export const SymbolNameSchema = z.string().regex(SYMBOL_PATTERN, 'Invalid symbol');
export const EntityIdSchema = z.string().regex(ID_PATTERN, 'Invalid identifier');
const positiveFinite = z.number().finite().positive();
const commentSchema = z.string().max(COMMENT_MAX_LENGTH);

export const OpenPositionRequestSchema = z.object({
  symbol: SymbolNameSchema,
  side: SideSchema,
  volume: positiveFinite,
  tpPrice: positiveFinite.nullish(),
  slPrice: positiveFinite.nullish(),
  comment: commentSchema.optional(),
});
export type OpenPositionRequest = z.infer<typeof OpenPositionRequestSchema>;

export const UpdatePositionRequestSchema = z
  .object({
    tpPrice: positiveFinite.nullable().optional(),
    slPrice: positiveFinite.nullable().optional(),
  })
  .refine((value) => value.tpPrice !== undefined || value.slPrice !== undefined, {
    message: 'Provide tpPrice and/or slPrice',
  });
export type UpdatePositionRequest = z.infer<typeof UpdatePositionRequestSchema>;

export const ClosePositionRequestSchema = z.object({ volume: positiveFinite });
export type ClosePositionRequest = z.infer<typeof ClosePositionRequestSchema>;

export const CreatePendingOrderRequestSchema = z.object({
  symbol: SymbolNameSchema,
  side: SideSchema,
  type: PendingOrderTypeSchema,
  volume: positiveFinite,
  activationPrice: positiveFinite,
  tpPrice: positiveFinite.nullish(),
  slPrice: positiveFinite.nullish(),
  comment: commentSchema.optional(),
});
export type CreatePendingOrderRequest = z.infer<typeof CreatePendingOrderRequestSchema>;

export const UpdatePendingOrderRequestSchema = z
  .object({
    activationPrice: positiveFinite.optional(),
    volume: positiveFinite.optional(),
    tpPrice: positiveFinite.nullable().optional(),
    slPrice: positiveFinite.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'Provide at least one field to update',
  });
export type UpdatePendingOrderRequest = z.infer<typeof UpdatePendingOrderRequestSchema>;

// --- errors -----------------------------------------------------------------------------------

export const ApiErrorBodySchema = z
  .object({
    path: z.string().optional(),
    status: z.number().optional(),
    type: z.string().optional(),
    title: z.string().optional(),
    detail: z.string().optional(),
    additionalInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .partial();
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

