import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/services/http/errors';
import { HttpClient } from '@/services/http/httpClient';
import { SlidingWindowRateLimiter } from '@/services/http/rateLimiter';
import { FortunoClient } from './client';

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

function setup(handler: Handler) {
  const fetchMock = vi.fn(async (input: string, init: RequestInit) => handler(new URL(input), init));
  const http = new HttpClient({
    baseUrl: 'https://api.test',
    getAuthToken: () => 'aaa.bbb.ccc',
    fetchImpl: fetchMock as unknown as typeof fetch,
    rateLimiter: new SlidingWindowRateLimiter(
      { trading: { limit: 60, windowMs: 60_000 }, candles: { limit: 20, windowMs: 60_000 } },
      { maxWaitMs: 1000 },
    ),
  });
  return { client: new FortunoClient(http), fetchMock };
}

const position = {
  id: 1,
  symbol: 'EURUSD',
  side: 'BUY',
  volume: 0.1,
  openPrice: 1.1,
  currentPrice: 1.2,
  openTime: 1,
  tpPrice: null,
  slPrice: undefined,
  profit: 5,
};

describe('FortunoClient – reads', () => {
  it('maps positions (ids stringified, defaults applied) and forwards symbol filters', async () => {
    const { client, fetchMock } = setup(() => jsonResponse({ positions: [position] }));
    const result = await client.getPositions(['EURUSD', 'GBPUSD']);
    expect(result[0]).toMatchObject({ id: '1', slPrice: null, tpPrice: null, swap: 0, comment: '' });
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.searchParams.getAll('symbol')).toEqual(['EURUSD', 'GBPUSD']);
  });

  it('rejects unsafe symbol names before any network call', async () => {
    const { client, fetchMock } = setup(() => jsonResponse({}));
    await expect(client.getQuotes(['EUR/USD?x=1'])).rejects.toBeInstanceOf(ValidationError);
    await expect(client.getQuotes([])).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on unknown access rights', async () => {
    const { client } = setup(() => jsonResponse({ login: 1, name: 'n', currency: 'USD', accessRight: 'WEIRD' }));
    expect((await client.getAccount()).accessRight).toBe('TRADING_DISABLED');
  });

  it('caches symbols and coalesces concurrent calls', async () => {
    const { client, fetchMock } = setup(() =>
      jsonResponse({ symbols: [{ symbol: 'EURUSD', pricePrecision: 5, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01 }] }),
    );
    await Promise.all([client.getSymbols(), client.getSymbols(), client.getSymbols()]);
    await client.getSymbols();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await client.getSymbols(undefined, { force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches candle pages per symbol/interval', async () => {
    const candle = { timestamp: 1, open: 1, high: 2, low: 0.5, close: 1.5 };
    const { client, fetchMock } = setup(() => jsonResponse({ candles: [candle] }));
    await client.getCandles('EURUSD', 'H1');
    await client.getCandles('EURUSD', 'H1');
    await client.getCandles('EURUSD', 'M5');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts both "ledger" and "ledgers" envelopes and "timestamp" field', async () => {
    const entry = { id: 'L1', type: 'DEPOSIT', amount: 10, time: 5 };
    const liveEntry = { id: 'L2', type: 'CLOSE_POSITION', amount: -0.07, timestamp: 1793962379503 };
    const a = setup(() => jsonResponse({ ledger: [entry] }));
    const b = setup(() => jsonResponse({ ledgers: [liveEntry] }));
    expect(await a.client.getLedgers({ from: 0, to: 10 })).toHaveLength(1);
    const liveLedgers = await b.client.getLedgers({ from: 0, to: 10 });
    expect(liveLedgers).toHaveLength(1);
    expect(liveLedgers[0]?.time).toBe(1793962379503);
  });

  it('normalizes live Match-Trader account-summary (freeFunds/profit), closedPositions, and numeric tradingHours', async () => {
    const { client } = setup((url) => {
      if (url.pathname.endsWith('/account-summary')) {
        return jsonResponse({
          balance: 7.79,
          credit: 0,
          equity: 7.79,
          freeFunds: 7.79,
          margin: 0,
          marginLevel: 0,
          profit: 1.25,
        });
      }
      if (url.pathname.endsWith('/closed-positions')) {
        return jsonResponse({
          closedPositions: [{ ...position, closePrice: 1.15, closeTime: 2000 }],
        });
      }
      return jsonResponse({
        tradingHours: [
          {
            symbol: 'EURUSD',
            sessions: [{ dayOfWeek: 1, open: '00:00:00', close: '23:59:59' }],
          },
        ],
      });
    });

    const summary = await client.getAccountSummary();
    expect(summary.freeMargin).toBe(7.79);
    expect(summary.floatingProfit).toBe(1.25);

    const closed = await client.getClosedPositions({ from: 0, to: 5000 });
    expect(closed).toHaveLength(1);

    const hours = await client.getTradingHours('EURUSD');
    expect(hours.symbol).toBe('EURUSD');
    expect(hours.sessions[0]?.dayOfWeek).toBe('MONDAY');
  });
});

describe('FortunoClient – writes', () => {
  it('open position sends an idempotency key and validated body', async () => {
    const { client, fetchMock } = setup(() => jsonResponse({ positionId: 99 }, { status: 201 }));
    const result = await client.openPosition({ symbol: 'EURUSD', side: 'BUY', volume: 0.01, slPrice: null });
    expect(result).toEqual({ positionId: '99' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body as string)).toEqual({ symbol: 'EURUSD', side: 'BUY', volume: 0.01, slPrice: null });
  });

  it('honours a caller supplied idempotency key', async () => {
    const { client, fetchMock } = setup(() => jsonResponse({ positionId: '1' }));
    await client.openPosition({ symbol: 'EURUSD', side: 'SELL', volume: 1 }, { idempotencyKey: 'my-key' });
    expect(((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers).get('Idempotency-Key')).toBe('my-key');
  });

  it.each([
    [{ symbol: 'EURUSD', side: 'HOLD', volume: 1 }],
    [{ symbol: 'EURUSD', side: 'BUY', volume: -1 }],
    [{ symbol: 'EURUSD', side: 'BUY', volume: Number.NaN }],
    [{ symbol: '../etc', side: 'BUY', volume: 1 }],
    [{ symbol: 'EURUSD', side: 'BUY', volume: 1, comment: 'x'.repeat(500) }],
  ])('rejects invalid order %j locally', async (request) => {
    const { client, fetchMock } = setup(() => jsonResponse({}));
    await expect(client.openPosition(request as never)).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('close position targets the encoded id and validates the id', async () => {
    const { client, fetchMock } = setup(() => jsonResponse({}));
    await client.closePosition('123', 0.05);
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).pathname).toBe('/v1/positions/123/close');
    await expect(client.closePosition('../../admin', 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(client.closePosition('1', 0)).rejects.toBeInstanceOf(ValidationError);
  });

  it('update position supports clearing TP/SL with null and rejects empty updates', async () => {
    const { client, fetchMock } = setup(() => new Response(null, { status: 204 }));
    await client.updatePosition('5', { tpPrice: 1.2, slPrice: null });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ tpPrice: 1.2, slPrice: null });
    await expect(client.updatePosition('5', {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('pending order lifecycle', async () => {
    const { client, fetchMock } = setup((url, init) => {
      if (init.method === 'POST') return jsonResponse({ orderId: 'O1' }, { status: 201 });
      return new Response(null, { status: 204 });
    });
    expect(
      await client.createPendingOrder({ symbol: 'EURUSD', side: 'BUY', type: 'LIMIT', volume: 0.1, activationPrice: 1.08 }),
    ).toEqual({ orderId: 'O1' });
    await client.updatePendingOrder('O1', { activationPrice: 1.07 });
    await client.cancelPendingOrder('O1');
    const methods = fetchMock.mock.calls.map((call) => (call[1] as RequestInit).method);
    expect(methods).toEqual(['POST', 'PATCH', 'DELETE']);
  });
});

describe('FortunoClient – paging', () => {
  it('closed positions: splits ranges across pages and de-duplicates boundary ties', async () => {
    const make = (id: number, closeTime: number) => ({ ...position, id, closePrice: 1, closeTime });
    const pages = [
      Array.from({ length: 500 }, (_, i) => make(i, 10_000 - i)), // closeTime 10000..9501
      [make(499, 9_501), make(1000, 9_500), make(1001, 9_000)], // includes one tie from page 1
    ];
    let call = 0;
    const { client, fetchMock } = setup(() => jsonResponse({ positions: pages[call++] }));
    const all = await client.getClosedPositionsAll({ from: 0, to: 20_000 });

    expect(all).toHaveLength(502);
    expect(new Set(all.map((p) => p.id)).size).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[1]?.[0] as string).searchParams.get('to')).toBe('9501');
  });

  it('closed positions: terminates when a full page makes no progress', async () => {
    const same = Array.from({ length: 500 }, (_, i) => ({ ...position, id: i, closePrice: 1, closeTime: 5000 }));
    const { client, fetchMock } = setup((url) =>
      jsonResponse({ positions: Number(url.searchParams.get('to')) >= 5000 ? same : [] }),
    );
    const all = await client.getClosedPositionsAll({ from: 0, to: 9_000 }, { maxPages: 10 });
    expect(all).toHaveLength(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('candles: pages backwards until a short page', async () => {
    const mk = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ timestamp: from + i, open: 1, high: 1, low: 1, close: 1 }));
    const pages = [mk(1000, 750), mk(250, 750), mk(0, 100)];
    let call = 0;
    const { client } = setup(() => jsonResponse({ candles: pages[call++] }));
    const all = await client.getCandlesAll('EURUSD', 'M1', { from: 0, to: 2000 });
    expect(all).toHaveLength(750 + 750 + 100 - 0);
    expect(all[0]?.timestamp).toBe(0);
    expect(all.at(-1)?.timestamp).toBe(1749);
  });
});
