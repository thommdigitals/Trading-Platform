import type { Candle } from '@/types/api';

/**
 * Technical indicators computed directly from Fortuno Markets OHLCV candles.
 * Every function returns an array aligned 1:1 with the input candles;
 * entries are `null` while there is not enough history to compute a value.
 */

export type Series = Array<number | null>;

export interface BollingerBands {
  upper: Series;
  middle: Series;
  lower: Series;
}

export interface DonchianChannel {
  upper: Series;
  middle: Series;
  lower: Series;
}

export interface MACDResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

export interface StochasticResult {
  k: Series;
  d: Series;
}

export type IndicatorKind =
  | 'SMA'
  | 'EMA'
  | 'WMA'
  | 'BB'
  | 'DC'
  | 'VWAP'
  | 'RSI'
  | 'MACD'
  | 'ATR'
  | 'STOCH';

export type IndicatorPlacement = 'overlay' | 'metric';

export interface IndicatorSpec {
  id: string;
  kind: IndicatorKind;
  period: number;
  label: string;
  description: string;
  color: string;
  placement: IndicatorPlacement;
}

export const BUILTIN_INDICATORS: readonly IndicatorSpec[] = [
  {
    id: 'SMA:9',
    kind: 'SMA',
    period: 9,
    label: 'SMA 9',
    description: 'Simple Moving Average cepat (9 candle)',
    color: '#22d3ee',
    placement: 'overlay',
  },
  {
    id: 'SMA:20',
    kind: 'SMA',
    period: 20,
    label: 'SMA 20',
    description: 'Simple Moving Average jangka pendek (20 candle)',
    color: '#38bdf8',
    placement: 'overlay',
  },
  {
    id: 'SMA:50',
    kind: 'SMA',
    period: 50,
    label: 'SMA 50',
    description: 'Simple Moving Average jangka menengah (50 candle)',
    color: '#f59e0b',
    placement: 'overlay',
  },
  {
    id: 'SMA:100',
    kind: 'SMA',
    period: 100,
    label: 'SMA 100',
    description: 'Simple Moving Average tren makro (100 candle)',
    color: '#fb7185',
    placement: 'overlay',
  },
  {
    id: 'SMA:200',
    kind: 'SMA',
    period: 200,
    label: 'SMA 200',
    description: 'Simple Moving Average institusional (200 candle)',
    color: '#ef4444',
    placement: 'overlay',
  },
  {
    id: 'EMA:9',
    kind: 'EMA',
    period: 9,
    label: 'EMA 9',
    description: 'Exponential Moving Average scalping (9 candle)',
    color: '#34d399',
    placement: 'overlay',
  },
  {
    id: 'EMA:20',
    kind: 'EMA',
    period: 20,
    label: 'EMA 20',
    description: 'Exponential Moving Average dinamis (20 candle)',
    color: '#a855f7',
    placement: 'overlay',
  },
  {
    id: 'EMA:50',
    kind: 'EMA',
    period: 50,
    label: 'EMA 50',
    description: 'Exponential Moving Average swing (50 candle)',
    color: '#ec4899',
    placement: 'overlay',
  },
  {
    id: 'EMA:200',
    kind: 'EMA',
    period: 200,
    label: 'EMA 200',
    description: 'Exponential Moving Average tren utama (200 candle)',
    color: '#eab308',
    placement: 'overlay',
  },
  {
    id: 'WMA:20',
    kind: 'WMA',
    period: 20,
    label: 'WMA 20',
    description: 'Weighted Moving Average responsif (20 candle)',
    color: '#14b8a6',
    placement: 'overlay',
  },
  {
    id: 'BB:20',
    kind: 'BB',
    period: 20,
    label: 'BB(20,2)',
    description: 'Bollinger Bands Upper & Lower (20, StdDev 2)',
    color: '#64748b',
    placement: 'overlay',
  },
  {
    id: 'DC:20',
    kind: 'DC',
    period: 20,
    label: 'Donchian(20)',
    description: 'Donchian Channel High/Low Breakout (20 candle)',
    color: '#06b6d4',
    placement: 'overlay',
  },
  {
    id: 'VWAP:20',
    kind: 'VWAP',
    period: 20,
    label: 'VWAP(20)',
    description: 'Volume-Weighted Average Price berbasis tick volume',
    color: '#f97316',
    placement: 'overlay',
  },
  {
    id: 'RSI:14',
    kind: 'RSI',
    period: 14,
    label: 'RSI(14)',
    description: 'Relative Strength Index momentum (Overbought >70 / Oversold <30)',
    color: '#60a5fa',
    placement: 'metric',
  },
  {
    id: 'MACD:12',
    kind: 'MACD',
    period: 12,
    label: 'MACD(12,26,9)',
    description: 'Moving Average Convergence Divergence momentum & sinyal',
    color: '#818cf8',
    placement: 'metric',
  },
  {
    id: 'ATR:14',
    kind: 'ATR',
    period: 14,
    label: 'ATR(14)',
    description: 'Average True Range volatilitas rata-rata instrumen',
    color: '#fbbf24',
    placement: 'metric',
  },
  {
    id: 'STOCH:14',
    kind: 'STOCH',
    period: 14,
    label: 'Stoch(14,3)',
    description: 'Stochastic Oscillator %K / %D momentum',
    color: '#2dd4bf',
    placement: 'metric',
  },
];

export const DEFAULT_FAVORITE_INDICATORS: readonly string[] = [
  'SMA:20',
  'SMA:50',
  'EMA:20',
  'BB:20',
  'VWAP:20',
  'RSI:14',
  'MACD:12',
  'ATR:14',
];

export const DEFAULT_ACTIVE_INDICATORS: readonly string[] = ['SMA:20', 'RSI:14'];

const KIND_COLORS: Record<IndicatorKind, string> = {
  SMA: '#38bdf8',
  EMA: '#a855f7',
  WMA: '#14b8a6',
  BB: '#64748b',
  DC: '#06b6d4',
  VWAP: '#f97316',
  RSI: '#60a5fa',
  MACD: '#818cf8',
  ATR: '#fbbf24',
  STOCH: '#2dd4bf',
};

export function resolveIndicatorSpec(id: string): IndicatorSpec | null {
  const normalized = id.trim().toUpperCase();
  const builtin = BUILTIN_INDICATORS.find((b) => b.id === normalized);
  if (builtin) return builtin;

  const [rawKind, rawPeriod] = normalized.split(':');
  const validKinds: IndicatorKind[] = [
    'SMA',
    'EMA',
    'WMA',
    'BB',
    'DC',
    'VWAP',
    'RSI',
    'MACD',
    'ATR',
    'STOCH',
  ];
  if (!rawKind || !validKinds.includes(rawKind as IndicatorKind)) return null;
  const kind = rawKind as IndicatorKind;
  const parsedPeriod = Number.parseInt(rawPeriod ?? '14', 10);
  const period = Number.isFinite(parsedPeriod)
    ? Math.min(500, Math.max(2, parsedPeriod))
    : 14;
  const placement: IndicatorPlacement =
    kind === 'RSI' || kind === 'MACD' || kind === 'ATR' || kind === 'STOCH'
      ? 'metric'
      : 'overlay';

  const label =
    kind === 'BB'
      ? `BB(${period},2)`
      : kind === 'DC'
        ? `Donchian(${period})`
        : kind === 'VWAP'
          ? `VWAP(${period})`
          : kind === 'MACD'
            ? `MACD(${period},26,9)`
            : kind === 'STOCH'
              ? `Stoch(${period},3)`
              : kind === 'RSI' || kind === 'ATR'
                ? `${kind}(${period})`
                : `${kind} ${period}`;

  return {
    id: `${kind}:${period}`,
    kind,
    period,
    label,
    description: `Indikator ${label} (dihitung dari candle Fortuno Markets)`,
    color: KIND_COLORS[kind],
    placement,
  };
}

function assertPeriod(period: number): void {
  if (!Number.isInteger(period) || period < 1) throw new RangeError('period must be a positive integer');
}

const closes = (candles: readonly Pick<Candle, 'close'>[]): number[] => candles.map((c) => c.close);

export function calculateSMA(candles: readonly Pick<Candle, 'close'>[], period: number): Series {
  assertPeriod(period);
  const values = closes(candles);
  const result: Series = new Array(values.length).fill(null);
  let windowSum = 0;
  for (let i = 0; i < values.length; i += 1) {
    windowSum += values[i] as number;
    if (i >= period) windowSum -= values[i - period] as number;
    if (i >= period - 1) result[i] = windowSum / period;
  }
  return result;
}

export function calculateEMA(candles: readonly Pick<Candle, 'close'>[], period: number): Series {
  assertPeriod(period);
  const values = closes(candles);
  const result: Series = new Array(values.length).fill(null);
  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i += 1) {
    ema = ((values[i] as number) - ema) * multiplier + ema;
    result[i] = ema;
  }
  return result;
}

export function calculateWMA(candles: readonly Pick<Candle, 'close'>[], period: number): Series {
  assertPeriod(period);
  const values = closes(candles);
  const result: Series = new Array(values.length).fill(null);
  if (values.length < period) return result;

  const weightSum = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i += 1) {
    let weighted = 0;
    for (let j = 0; j < period; j += 1) {
      weighted += (values[i - period + 1 + j] as number) * (j + 1);
    }
    result[i] = weighted / weightSum;
  }
  return result;
}

/** Wilder's RSI. */
export function calculateRSI(candles: readonly Pick<Candle, 'close'>[], period = 14): Series {
  assertPeriod(period);
  const values = closes(candles);
  const result: Series = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = (values[i] as number) - (values[i - 1] as number);
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  const toRsi = () => (averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss));
  result[period] = toRsi();

  for (let i = period + 1; i < values.length; i += 1) {
    const change = (values[i] as number) - (values[i - 1] as number);
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[i] = toRsi();
  }
  return result;
}

export function calculateBollingerBands(
  candles: readonly Pick<Candle, 'close'>[],
  period = 20,
  stdDev = 2,
): BollingerBands {
  assertPeriod(period);
  const values = closes(candles);
  const middle = calculateSMA(candles, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i += 1) {
    const mean = middle[i] as number;
    const window = values.slice(i - period + 1, i + 1);
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    const deviation = Math.sqrt(variance) * stdDev;
    upper[i] = mean + deviation;
    lower[i] = mean - deviation;
  }
  return { upper, middle, lower };
}

export function calculateDonchianChannel(
  candles: readonly Pick<Candle, 'high' | 'low'>[],
  period = 20,
): DonchianChannel {
  assertPeriod(period);
  const upper: Series = new Array(candles.length).fill(null);
  const middle: Series = new Array(candles.length).fill(null);
  const lower: Series = new Array(candles.length).fill(null);

  for (let i = period - 1; i < candles.length; i += 1) {
    let maxHigh = -Infinity;
    let minLow = Infinity;
    for (let j = i - period + 1; j <= i; j += 1) {
      const bar = candles[j]!;
      if (bar.high > maxHigh) maxHigh = bar.high;
      if (bar.low < minLow) minLow = bar.low;
    }
    upper[i] = maxHigh;
    lower[i] = minLow;
    middle[i] = (maxHigh + minLow) / 2;
  }
  return { upper, middle, lower };
}

export function calculateVWAP(
  candles: readonly Pick<Candle, 'high' | 'low' | 'close' | 'tickCount'>[],
  period = 20,
): Series {
  assertPeriod(period);
  const result: Series = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i += 1) {
    let pvSum = 0;
    let volSum = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      const bar = candles[j]!;
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      const vol = Math.max(1, bar.tickCount);
      pvSum += typicalPrice * vol;
      volSum += vol;
    }
    result[i] = volSum > 0 ? pvSum / volSum : null;
  }
  return result;
}

export function calculateATR(
  candles: readonly Pick<Candle, 'high' | 'low' | 'close'>[],
  period = 14,
): Series {
  assertPeriod(period);
  const result: Series = new Array(candles.length).fill(null);
  if (candles.length <= period) return result;

  const trs: number[] = new Array(candles.length).fill(0);
  for (let i = 0; i < candles.length; i += 1) {
    const cur = candles[i]!;
    if (i === 0) {
      trs[i] = cur.high - cur.low;
    } else {
      const prevClose = candles[i - 1]!.close;
      trs[i] = Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prevClose),
        Math.abs(cur.low - prevClose),
      );
    }
  }

  let atr = trs.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  result[period] = atr;
  for (let i = period + 1; i < candles.length; i += 1) {
    atr = (atr * (period - 1) + (trs[i] as number)) / period;
    result[i] = atr;
  }
  return result;
}

export function calculateMACD(
  candles: readonly Pick<Candle, 'close'>[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  const fast = calculateEMA(candles, fastPeriod);
  const slow = calculateEMA(candles, slowPeriod);
  const macd: Series = new Array(candles.length).fill(null);
  const macdValid: Array<{ idx: number; val: number }> = [];

  for (let i = 0; i < candles.length; i += 1) {
    const f = fast[i];
    const s = slow[i];
    if (f !== null && f !== undefined && s !== null && s !== undefined) {
      const diff = f - s;
      macd[i] = diff;
      macdValid.push({ idx: i, val: diff });
    }
  }

  const signal: Series = new Array(candles.length).fill(null);
  const histogram: Series = new Array(candles.length).fill(null);

  if (macdValid.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sig =
      macdValid.slice(0, signalPeriod).reduce((acc, item) => acc + item.val, 0) / signalPeriod;
    const firstSignalIdx = macdValid[signalPeriod - 1]!.idx;
    signal[firstSignalIdx] = sig;
    histogram[firstSignalIdx] = (macd[firstSignalIdx] as number) - sig;

    for (let j = signalPeriod; j < macdValid.length; j += 1) {
      const item = macdValid[j]!;
      sig = (item.val - sig) * k + sig;
      signal[item.idx] = sig;
      histogram[item.idx] = item.val - sig;
    }
  }

  return { macd, signal, histogram };
}

export function calculateStochastic(
  candles: readonly Pick<Candle, 'high' | 'low' | 'close'>[],
  kPeriod = 14,
  dPeriod = 3,
): StochasticResult {
  assertPeriod(kPeriod);
  assertPeriod(dPeriod);
  const k: Series = new Array(candles.length).fill(null);
  const d: Series = new Array(candles.length).fill(null);

  for (let i = kPeriod - 1; i < candles.length; i += 1) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j += 1) {
      const bar = candles[j]!;
      if (bar.high > highest) highest = bar.high;
      if (bar.low < lowest) lowest = bar.low;
    }
    const denom = highest - lowest;
    k[i] = denom === 0 ? 50 : ((candles[i]!.close - lowest) / denom) * 100;
  }

  for (let i = kPeriod - 1 + dPeriod - 1; i < candles.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j += 1) {
      const val = k[j];
      if (val !== null && val !== undefined) {
        sum += val;
        count += 1;
      }
    }
    d[i] = count === dPeriod ? sum / dPeriod : null;
  }

  return { k, d };
}

/** Last non-null value of a series. */
export function lastValue(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

