import type { Candle } from '@/types/api';

/**
 * Technical indicators. Every function returns an array aligned 1:1 with the input candles;
 * entries are `null` while there is not enough history to compute a value.
 */

export type Series = Array<number | null>;

export interface BollingerBands {
  upper: Series;
  middle: Series;
  lower: Series;
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

/** Last non-null value of a series. */
export function lastValue(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

