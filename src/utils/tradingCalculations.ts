import type {
  ClosedPosition,
  LedgerEntry,
  PendingOrderType,
  Position,
  Quote,
  Side,
  SymbolInfo,
} from '@/types/api';

/** Pure trading maths & validation rules. No I/O, fully unit-tested. */

const EPSILON = 1e-9;

export function countDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = value.toString().toLowerCase();
  if (text.includes('e-')) {
    const [mantissa = '', exponent = '0'] = text.split('e-');
    return Number(exponent) + (mantissa.split('.')[1]?.length ?? 0);
  }
  return text.split('.')[1]?.length ?? 0;
}

export const roundTo = (value: number, decimals: number): number =>
  Number(`${Math.round(Number(`${value}e${decimals}`))}e-${decimals}`);

export const roundPrice = (price: number, symbol: Pick<SymbolInfo, 'pricePrecision'>): number =>
  roundTo(price, symbol.pricePrecision);

export const getSpread = (quote: Pick<Quote, 'bid' | 'ask'>): number => quote.ask - quote.bid;

/** Spread expressed in pips (assumes 1 pip = 10 points for 3/5 digit symbols). */
export function getSpreadPips(quote: Pick<Quote, 'bid' | 'ask'>, pricePrecision: number): number {
  const pipSize = pricePrecision === 3 || pricePrecision === 5 ? 10 ** -(pricePrecision - 1) : 10 ** -pricePrecision;
  return getSpread(quote) / pipSize;
}

/** Returns an error message or `null` when the volume is valid for the symbol. */
export function validateVolume(volume: number, symbol: SymbolInfo): string | null {
  if (!Number.isFinite(volume) || volume <= 0) return 'Volume harus lebih dari 0';
  if (volume < symbol.volumeMin - EPSILON) return `Volume minimum: ${symbol.volumeMin}`;
  if (volume > symbol.volumeMax + EPSILON) return `Volume maksimum: ${symbol.volumeMax}`;

  const decimals = Math.max(countDecimals(symbol.volumeStep), countDecimals(symbol.volumeMin), countDecimals(volume));
  const scale = 10 ** decimals;
  const stepUnits = Math.round(symbol.volumeStep * scale);
  const offsetUnits = Math.round((volume - symbol.volumeMin) * scale);
  if (stepUnits > 0 && offsetUnits % stepUnits !== 0) {
    return `Volume harus kelipatan ${symbol.volumeStep}`;
  }
  return null;
}

/** Snaps a volume to the nearest valid step inside [min, max]. */
export function normalizeVolume(volume: number, symbol: SymbolInfo): number {
  const clamped = Math.min(Math.max(volume, symbol.volumeMin), symbol.volumeMax);
  const steps = Math.round((clamped - symbol.volumeMin) / symbol.volumeStep);
  const decimals = Math.max(countDecimals(symbol.volumeStep), countDecimals(symbol.volumeMin));
  const snapped = roundTo(symbol.volumeMin + steps * symbol.volumeStep, decimals);
  return Math.min(snapped, symbol.volumeMax);
}

export interface TpSlInput {
  side: Side;
  tpPrice?: number | null;
  slPrice?: number | null;
  quote: Pick<Quote, 'bid' | 'ask'>;
}

/**
 * TP/SL direction rules.
 *  BUY : TP > ask, SL < bid
 *  SELL: TP < bid, SL > ask
 */
export function validateTpSl({ side, tpPrice, slPrice, quote }: TpSlInput): {
  tp: string | null;
  sl: string | null;
} {
  const result: { tp: string | null; sl: string | null } = { tp: null, sl: null };
  if (tpPrice !== null && tpPrice !== undefined) {
    if (side === 'BUY' && tpPrice <= quote.ask) result.tp = `TP BUY harus di atas ask (${quote.ask})`;
    if (side === 'SELL' && tpPrice >= quote.bid) result.tp = `TP SELL harus di bawah bid (${quote.bid})`;
  }
  if (slPrice !== null && slPrice !== undefined) {
    if (side === 'BUY' && slPrice >= quote.bid) result.sl = `SL BUY harus di bawah bid (${quote.bid})`;
    if (side === 'SELL' && slPrice <= quote.ask) result.sl = `SL SELL harus di atas ask (${quote.ask})`;
  }
  return result;
}

export interface ActivationInput {
  type: PendingOrderType;
  side: Side;
  activationPrice: number;
  quote: Pick<Quote, 'bid' | 'ask'>;
}

/** Rule text shown as a live hint in the pending-order form. */
export function describeActivationRule(
  type: PendingOrderType,
  side: Side,
  quote: Pick<Quote, 'bid' | 'ask'>,
): string {
  const rules: Record<`${Side}_${PendingOrderType}`, string> = {
    BUY_LIMIT: `BUY LIMIT: harga harus di bawah ask saat ini (${quote.ask})`,
    BUY_STOP: `BUY STOP: harga harus di atas ask saat ini (${quote.ask})`,
    SELL_LIMIT: `SELL LIMIT: harga harus di atas bid saat ini (${quote.bid})`,
    SELL_STOP: `SELL STOP: harga harus di bawah bid saat ini (${quote.bid})`,
  };
  return rules[`${side}_${type}`];
}

export function validateActivationPrice({ type, side, activationPrice, quote }: ActivationInput): string | null {
  const valid =
    (side === 'BUY' && type === 'LIMIT' && activationPrice < quote.ask) ||
    (side === 'BUY' && type === 'STOP' && activationPrice > quote.ask) ||
    (side === 'SELL' && type === 'LIMIT' && activationPrice > quote.bid) ||
    (side === 'SELL' && type === 'STOP' && activationPrice < quote.bid);
  return valid ? null : describeActivationRule(type, side, quote);
}

/** Net P&L of an open/closed position = profit + swap + commission (swap/commission are signed). */
export const netPnl = (position: Pick<Position, 'profit' | 'swap' | 'commission'>): number =>
  position.profit + position.swap + position.commission;

/** Indicative notional margin (quote currency). The broker's figure is authoritative. */
export function estimateMargin(
  volume: number,
  price: number,
  symbol: Pick<SymbolInfo, 'contractSize'>,
  leverage: number,
): number {
  if (leverage <= 0) return 0;
  return (volume * symbol.contractSize * price) / leverage;
}

export function summarizePositions(positions: readonly Position[]) {
  return positions.reduce(
    (acc, position) => ({
      count: acc.count + 1,
      totalVolume: roundTo(acc.totalVolume + position.volume, 8),
      totalProfit: acc.totalProfit + netPnl(position),
    }),
    { count: 0, totalVolume: 0, totalProfit: 0 },
  );
}

export interface ClosedSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  averageProfit: number;
  averageLoss: number;
}

export function summarizeClosedPositions(positions: readonly ClosedPosition[]): ClosedSummary {
  const pnls = positions.map(netPnl);
  const winning = pnls.filter((pnl) => pnl > 0);
  const losing = pnls.filter((pnl) => pnl < 0);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return {
    totalTrades: positions.length,
    wins: winning.length,
    losses: losing.length,
    winRate: positions.length === 0 ? 0 : (winning.length / positions.length) * 100,
    totalPnl: sum(pnls),
    averageProfit: winning.length === 0 ? 0 : sum(winning) / winning.length,
    averageLoss: losing.length === 0 ? 0 : sum(losing) / losing.length,
  };
}

export function summarizeLedger(entries: readonly LedgerEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.type] = (acc[entry.type] ?? 0) + entry.amount;
    return acc;
  }, {});
}

