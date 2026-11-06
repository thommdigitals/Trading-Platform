import { describe, expect, it } from 'vitest';
import type { ClosedPosition, Position, SymbolInfo } from '@/types/api';
import {
  countDecimals,
  describeActivationRule,
  estimateMargin,
  getSpread,
  getSpreadPips,
  netPnl,
  normalizeVolume,
  roundPrice,
  roundTo,
  summarizeClosedPositions,
  summarizeLedger,
  summarizePositions,
  validateActivationPrice,
  validateTpSl,
  validateVolume,
} from './tradingCalculations';

const symbol: SymbolInfo = {
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
  sessionOpen: null,
  type: null,
};
const quote = { bid: 1.1, ask: 1.1002 };

const pos = (over: Partial<Position> = {}): Position => ({
  id: '1', symbol: 'EURUSD', alias: '', side: 'BUY', volume: 1, openPrice: 1, currentPrice: 1, openTime: 0,
  tpPrice: null, slPrice: null, swap: 0, commission: 0, profit: 0, comment: '', ...over,
});

describe('number helpers', () => {
  it('countDecimals handles floats and exponents', () => {
    expect(countDecimals(1)).toBe(0);
    expect(countDecimals(0.01)).toBe(2);
    expect(countDecimals(1e-7)).toBe(7);
    expect(countDecimals(1.25e-3)).toBe(5);
    expect(countDecimals(Number.NaN)).toBe(0);
  });

  it('roundTo avoids binary float artefacts', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(0.1 + 0.2, 10)).toBe(0.3);
    expect(roundPrice(1.123456789, symbol)).toBe(1.12346);
  });

  it('spread & pips', () => {
    expect(getSpread(quote)).toBeCloseTo(0.0002, 10);
    expect(getSpreadPips(quote, 5)).toBeCloseTo(2, 5);
    expect(getSpreadPips({ bid: 100, ask: 100.5 }, 2)).toBeCloseTo(50, 5);
  });
});

describe('validateVolume', () => {
  it.each([0.01, 0.1, 0.07, 1, 99.99, 100])('accepts %s', (v) => expect(validateVolume(v, symbol)).toBeNull());
  it.each([
    [0, 'lebih dari 0'],
    [-1, 'lebih dari 0'],
    [Number.NaN, 'lebih dari 0'],
    [0.005, 'minimum'],
    [100.01, 'maksimum'],
    [0.015, 'kelipatan'],
  ])('rejects %s', (v, text) => expect(validateVolume(v, symbol)).toContain(text));

  it('handles a non-trivial min/step', () => {
    const s = { ...symbol, volumeMin: 0.1, volumeStep: 0.5, volumeMax: 10 };
    expect(validateVolume(0.6, s)).toBeNull();
    expect(validateVolume(1.1, s)).toBeNull();
    expect(validateVolume(0.5, s)).toContain('kelipatan');
  });

  it('normalizeVolume snaps and clamps', () => {
    expect(normalizeVolume(0.014, symbol)).toBe(0.01);
    expect(normalizeVolume(0.016, symbol)).toBe(0.02);
    expect(normalizeVolume(1000, symbol)).toBe(100);
    expect(normalizeVolume(0, symbol)).toBe(0.01);
  });
});

describe('validateTpSl', () => {
  it('BUY: TP above ask, SL below bid', () => {
    expect(validateTpSl({ side: 'BUY', tpPrice: 1.11, slPrice: 1.09, quote })).toEqual({ tp: null, sl: null });
    expect(validateTpSl({ side: 'BUY', tpPrice: 1.1002, slPrice: 1.1, quote })).toMatchObject({
      tp: expect.stringContaining('di atas ask'),
      sl: expect.stringContaining('di bawah bid'),
    });
  });

  it('SELL: TP below bid, SL above ask', () => {
    expect(validateTpSl({ side: 'SELL', tpPrice: 1.09, slPrice: 1.11, quote })).toEqual({ tp: null, sl: null });
    expect(validateTpSl({ side: 'SELL', tpPrice: 1.1, slPrice: 1.1002, quote })).toMatchObject({
      tp: expect.stringContaining('di bawah bid'),
      sl: expect.stringContaining('di atas ask'),
    });
  });

  it('treats null/undefined as "not set"', () => {
    expect(validateTpSl({ side: 'BUY', tpPrice: null, quote })).toEqual({ tp: null, sl: null });
  });
});

describe('validateActivationPrice', () => {
  it.each([
    ['BUY', 'LIMIT', 1.09, true],
    ['BUY', 'LIMIT', 1.11, false],
    ['BUY', 'STOP', 1.11, true],
    ['BUY', 'STOP', 1.09, false],
    ['SELL', 'LIMIT', 1.11, true],
    ['SELL', 'LIMIT', 1.09, false],
    ['SELL', 'STOP', 1.09, true],
    ['SELL', 'STOP', 1.11, false],
  ] as const)('%s %s @ %s valid=%s', (side, type, price, valid) => {
    const result = validateActivationPrice({ side, type, activationPrice: price, quote });
    expect(result === null).toBe(valid);
    if (!valid) expect(result).toBe(describeActivationRule(type, side, quote));
  });

  it('does not accept the exact reference price', () => {
    expect(validateActivationPrice({ side: 'BUY', type: 'LIMIT', activationPrice: quote.ask, quote })).not.toBeNull();
    expect(validateActivationPrice({ side: 'SELL', type: 'STOP', activationPrice: quote.bid, quote })).not.toBeNull();
  });
});

describe('summaries', () => {
  it('netPnl includes swap and commission', () => {
    expect(netPnl(pos({ profit: 10, swap: -1, commission: -2 }))).toBe(7);
  });

  it('summarizePositions', () => {
    const s = summarizePositions([pos({ volume: 0.1, profit: 5 }), pos({ volume: 0.2, profit: -2, commission: -1 })]);
    expect(s).toEqual({ count: 2, totalVolume: 0.3, totalProfit: 2 });
    expect(summarizePositions([])).toEqual({ count: 0, totalVolume: 0, totalProfit: 0 });
  });

  it('summarizeClosedPositions computes win rate and averages', () => {
    const closed = (profit: number): ClosedPosition => ({ ...pos({ profit }), closePrice: 1, closeTime: 1 });
    const s = summarizeClosedPositions([closed(10), closed(30), closed(-20), closed(0)]);
    expect(s).toMatchObject({ totalTrades: 4, wins: 2, losses: 1, totalPnl: 20, averageProfit: 20, averageLoss: -20 });
    expect(s.winRate).toBe(50);
    expect(summarizeClosedPositions([])).toMatchObject({ winRate: 0, totalPnl: 0 });
  });

  it('summarizeLedger groups by type', () => {
    const entry = (type: string, amount: number) => ({ id: type + amount, type, amount, balanceAfter: null, time: 0, comment: '' });
    expect(summarizeLedger([entry('DEPOSIT', 100), entry('DEPOSIT', 50), entry('SWAP', -1)])).toEqual({ DEPOSIT: 150, SWAP: -1 });
  });

  it('estimateMargin guards against zero leverage', () => {
    expect(estimateMargin(1, 1.1, symbol, 100)).toBeCloseTo(1100, 6);
    expect(estimateMargin(1, 1.1, symbol, 0)).toBe(0);
  });
});

