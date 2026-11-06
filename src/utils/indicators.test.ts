import { describe, expect, it } from 'vitest';
import { calculateBollingerBands, calculateEMA, calculateRSI, calculateSMA, lastValue } from './indicators';

const candles = (...closes: number[]) => closes.map((close) => ({ close }));

describe('indicators', () => {
  it('SMA is aligned with input and null until warm', () => {
    expect(calculateSMA(candles(1, 2, 3, 4, 5), 3)).toEqual([null, null, 2, 3, 4]);
    expect(calculateSMA([], 3)).toEqual([]);
  });

  it('EMA seeds with the SMA and then smooths', () => {
    const ema = calculateEMA(candles(1, 2, 3, 4, 5), 3);
    expect(ema.slice(0, 2)).toEqual([null, null]);
    expect(ema[2]).toBe(2);
    expect(ema[3]).toBeCloseTo(3, 10);
    expect(ema[4]).toBeCloseTo(4, 10);
    expect(calculateEMA(candles(1, 2), 5)).toEqual([null, null]);
  });

  it('RSI is 100 for a monotonic rise, 0 for a monotonic fall', () => {
    const up = calculateRSI(candles(...Array.from({ length: 20 }, (_, i) => i + 1)), 14);
    expect(up.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(up[14]).toBe(100);
    const down = calculateRSI(candles(...Array.from({ length: 20 }, (_, i) => 20 - i)), 14);
    expect(down[14]).toBe(0);
  });

  it('RSI matches a known reference (Wilder, period 14)', () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0,
      46.03, 46.41, 46.22, 45.64,
    ];
    const rsi = calculateRSI(candles(...closes), 14);
    expect(rsi[14]).toBeCloseTo(70.46, 1);
    expect(rsi[15]).toBeCloseTo(66.25, 1);
  });

  it('Bollinger bands bracket the SMA symmetrically; flat prices collapse the band', () => {
    const bb = calculateBollingerBands(candles(1, 2, 3, 4, 5, 6), 3, 2);
    expect(bb.middle[2]).toBe(2);
    const spread = Math.sqrt(2 / 3) * 2;
    expect(bb.upper[2]).toBeCloseTo(2 + spread, 10);
    expect(bb.lower[2]).toBeCloseTo(2 - spread, 10);
    const flat = calculateBollingerBands(candles(5, 5, 5, 5), 3);
    expect(flat.upper[3]).toBe(5);
    expect(flat.lower[3]).toBe(5);
  });

  it('validates the period', () => {
    expect(() => calculateSMA(candles(1), 0)).toThrow(RangeError);
    expect(() => calculateRSI(candles(1), 1.5)).toThrow(RangeError);
  });

  it('lastValue skips trailing nulls', () => {
    expect(lastValue([1, 2, null])).toBe(2);
    expect(lastValue([null, null])).toBeNull();
  });
});

