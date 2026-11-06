import { CANDLE_INTERVAL_MS, type CandleInterval } from '@/config/market';
import type {
  Account,
  AccountSummary,
  Candle,
  ClosedPosition,
  LedgerEntry,
  PendingOrder,
  Position,
  Quote,
  SymbolInfo,
  TradingHours,
} from '@/types/api';

/**
 * Self-contained Match-Trader REST simulator used ONLY when the user explicitly activates
 * "Demo Sandbox" mode on the login screen. Speaks the exact wire format of the 17 endpoints so the
 * full `FortunoClient` + `HttpClient` + Zod validation pipeline runs unmodified.
 */

const DEMO_SYMBOLS: SymbolInfo[] = [
  {
    symbol: 'EURUSD',
    alias: 'EUR/USD',
    pricePrecision: 5,
    volumeMin: 0.01,
    volumeMax: 100,
    volumeStep: 0.01,
    contractSize: 100_000,
    swapLong: -0.52,
    swapShort: 0.24,
    marginRequired: 1.0,
    sessionOpen: true,
    type: 'FOREX',
  },
  {
    symbol: 'GBPUSD',
    alias: 'GBP/USD',
    pricePrecision: 5,
    volumeMin: 0.01,
    volumeMax: 100,
    volumeStep: 0.01,
    contractSize: 100_000,
    swapLong: -0.48,
    swapShort: 0.18,
    marginRequired: 1.0,
    sessionOpen: true,
    type: 'FOREX',
  },
  {
    symbol: 'USDJPY',
    alias: 'USD/JPY',
    pricePrecision: 3,
    volumeMin: 0.01,
    volumeMax: 100,
    volumeStep: 0.01,
    contractSize: 100_000,
    swapLong: 0.65,
    swapShort: -1.15,
    marginRequired: 1.0,
    sessionOpen: true,
    type: 'FOREX',
  },
  {
    symbol: 'AUDUSD',
    alias: 'AUD/USD',
    pricePrecision: 5,
    volumeMin: 0.01,
    volumeMax: 100,
    volumeStep: 0.01,
    contractSize: 100_000,
    swapLong: -0.35,
    swapShort: 0.1,
    marginRequired: 1.0,
    sessionOpen: true,
    type: 'FOREX',
  },
  {
    symbol: 'XAUUSD',
    alias: 'Gold / USD',
    pricePrecision: 2,
    volumeMin: 0.01,
    volumeMax: 50,
    volumeStep: 0.01,
    contractSize: 100,
    swapLong: -1.85,
    swapShort: 0.55,
    marginRequired: 1.0,
    sessionOpen: true,
    type: 'COMMODITIES',
  },
  {
    symbol: 'BTCUSD',
    alias: 'Bitcoin / USD',
    pricePrecision: 2,
    volumeMin: 0.01,
    volumeMax: 20,
    volumeStep: 0.01,
    contractSize: 1,
    swapLong: -2.5,
    swapShort: -2.5,
    marginRequired: 2.0,
    sessionOpen: true,
    type: 'CRYPTO',
  },
  {
    symbol: 'US500',
    alias: 'S&P 500 Index',
    pricePrecision: 2,
    volumeMin: 0.1,
    volumeMax: 100,
    volumeStep: 0.1,
    contractSize: 10,
    swapLong: -0.9,
    swapShort: 0.2,
    marginRequired: 1.0,
    sessionOpen: true,
    type: 'INDICES',
  },
];

const BASE_PRICES: Record<string, { mid: number; spread: number; volatility: number }> = {
  EURUSD: { mid: 1.0864, spread: 0.00012, volatility: 0.00025 },
  GBPUSD: { mid: 1.2652, spread: 0.00015, volatility: 0.0003 },
  USDJPY: { mid: 152.45, spread: 0.014, volatility: 0.04 },
  AUDUSD: { mid: 0.6584, spread: 0.00014, volatility: 0.00022 },
  XAUUSD: { mid: 2642.5, spread: 0.35, volatility: 1.2 },
  BTCUSD: { mid: 88450.0, spread: 18.0, volatility: 75.0 },
  US500: { mid: 5895.0, spread: 0.6, volatility: 2.5 },
};

class DemoBrokerState {
  balance = 10_000;
  private tickStep = 0;
  private nextId = 1005;
  private mids: Record<string, number> = Object.fromEntries(
    Object.entries(BASE_PRICES).map(([sym, cfg]) => [sym, cfg.mid]),
  );

  positions: Position[] = [
    {
      id: '1001',
      symbol: 'EURUSD',
      alias: 'EUR/USD',
      side: 'BUY',
      volume: 0.1,
      openPrice: 1.085,
      currentPrice: 1.0864,
      openTime: Date.now() - 3_600_000 * 3,
      tpPrice: 1.092,
      slPrice: 1.081,
      swap: -0.5,
      commission: -0.7,
      profit: 14.0,
      comment: 'Trend continuation',
    },
    {
      id: '1002',
      symbol: 'XAUUSD',
      alias: 'Gold / USD',
      side: 'SELL',
      volume: 0.05,
      openPrice: 2646.0,
      currentPrice: 2642.5,
      openTime: Date.now() - 3_600_000 * 2,
      tpPrice: 2625.0,
      slPrice: 2658.0,
      swap: 0.2,
      commission: -0.5,
      profit: 17.5,
      comment: 'Resistance rejection',
    },
  ];

  pendingOrders: PendingOrder[] = [
    {
      id: '2001',
      symbol: 'GBPUSD',
      alias: 'GBP/USD',
      type: 'LIMIT',
      side: 'BUY',
      volume: 0.1,
      activationPrice: 1.261,
      tpPrice: 1.272,
      slPrice: 1.256,
      createTime: Date.now() - 3_600_000 * 5,
      comment: 'Pullback support',
    },
  ];

  closedPositions: ClosedPosition[] = [
    {
      id: '901',
      symbol: 'EURUSD',
      alias: 'EUR/USD',
      side: 'BUY',
      volume: 0.2,
      openPrice: 1.0815,
      currentPrice: 1.086,
      closePrice: 1.086,
      openTime: Date.now() - 86_400_000 * 2,
      closeTime: Date.now() - 86_400_000 * 2 + 7_200_000,
      tpPrice: 1.086,
      slPrice: 1.078,
      swap: -0.4,
      commission: -1.4,
      profit: 90.0,
      comment: 'London breakout',
    },
    {
      id: '902',
      symbol: 'USDJPY',
      alias: 'USD/JPY',
      side: 'SELL',
      volume: 0.1,
      openPrice: 152.1,
      currentPrice: 152.45,
      closePrice: 152.45,
      openTime: Date.now() - 86_400_000,
      closeTime: Date.now() - 86_400_000 + 5_400_000,
      tpPrice: 151.4,
      slPrice: 152.45,
      swap: -0.6,
      commission: -0.7,
      profit: -23.0,
      comment: 'Stopped out',
    },
    {
      id: '903',
      symbol: 'XAUUSD',
      alias: 'Gold / USD',
      side: 'BUY',
      volume: 0.1,
      openPrice: 2628.0,
      currentPrice: 2641.2,
      closePrice: 2641.2,
      openTime: Date.now() - 3_600_000 * 14,
      closeTime: Date.now() - 3_600_000 * 9,
      tpPrice: 2642.0,
      slPrice: 2618.0,
      swap: -0.8,
      commission: -1.0,
      profit: 132.0,
      comment: 'Momentum buy',
    },
  ];

  ledgers: LedgerEntry[] = [
    {
      id: 'L1',
      type: 'DEPOSIT',
      amount: 10_000,
      balanceAfter: 10_000,
      time: Date.now() - 86_400_000 * 5,
      comment: 'Initial deposit',
    },
    {
      id: 'L2',
      type: 'COMMISSION',
      amount: -3.1,
      balanceAfter: 9_996.9,
      time: Date.now() - 86_400_000 * 2,
      comment: 'Trading commission',
    },
    {
      id: 'L3',
      type: 'SWAP',
      amount: -1.8,
      balanceAfter: 9_995.1,
      time: Date.now() - 86_400_000,
      comment: 'Overnight rollover',
    },
  ];

  allocId(prefix = ''): string {
    this.nextId += 1;
    return `${prefix}${this.nextId}`;
  }

  getQuote(symbol: string): Quote {
    const info = DEMO_SYMBOLS.find((s) => s.symbol === symbol) ?? DEMO_SYMBOLS[0]!;
    const cfg = BASE_PRICES[symbol] ?? { mid: 1.0, spread: 0.0002, volatility: 0.0002 };
    this.tickStep += 1;
    const wave = Math.sin(this.tickStep * 0.45 + symbol.charCodeAt(0)) * cfg.volatility * 0.35;
    const mid = (this.mids[symbol] ?? cfg.mid) + wave;
    this.mids[symbol] = mid;
    const half = cfg.spread / 2;
    const bid = Number((mid - half).toFixed(info.pricePrecision));
    const ask = Number((mid + half).toFixed(info.pricePrecision));
    return { symbol, bid, ask, timestamp: Date.now() };
  }

  getSummary(): AccountSummary {
    let floatingProfit = 0;
    let margin = 0;
    for (const pos of this.positions) {
      const q = this.getQuote(pos.symbol);
      const info = DEMO_SYMBOLS.find((s) => s.symbol === pos.symbol);
      const contractSize = info?.contractSize ?? 100_000;
      const mark = pos.side === 'BUY' ? q.bid : q.ask;
      pos.currentPrice = mark;
      const raw = (pos.side === 'BUY' ? mark - pos.openPrice : pos.openPrice - mark) * pos.volume * contractSize;
      pos.profit = Number(raw.toFixed(2));
      floatingProfit += pos.profit + pos.swap + pos.commission;
      margin += (pos.volume * contractSize * pos.openPrice) / 100;
    }
    floatingProfit = Number(floatingProfit.toFixed(2));
    margin = Number(margin.toFixed(2));
    const equity = Number((this.balance + floatingProfit).toFixed(2));
    const freeMargin = Number((equity - margin).toFixed(2));
    const marginLevel = margin > 0 ? Number(((equity / margin) * 100).toFixed(2)) : null;
    return { balance: this.balance, equity, margin, freeMargin, marginLevel, floatingProfit };
  }

  buildCandles(symbol: string, interval: CandleInterval, limit: number): Candle[] {
    const info = DEMO_SYMBOLS.find((s) => s.symbol === symbol) ?? DEMO_SYMBOLS[0]!;
    const cfg = BASE_PRICES[symbol] ?? { mid: 1.0, spread: 0.0002, volatility: 0.0002 };
    const stepMs = CANDLE_INTERVAL_MS[interval] ?? 3_600_000;
    const nowBucket = Math.floor(Date.now() / stepMs) * stepMs;
    const count = Math.min(Math.max(limit, 10), 750);
    const candles: Candle[] = [];
    let price = cfg.mid - cfg.volatility * 6;

    for (let i = count - 1; i >= 0; i -= 1) {
      const ts = nowBucket - i * stepMs;
      const seed = Math.sin(i * 0.22 + symbol.charCodeAt(0)) + Math.cos(i * 0.11);
      const delta = seed * cfg.volatility * 0.6;
      const open = Number(price.toFixed(info.pricePrecision));
      const close = Number((open + delta).toFixed(info.pricePrecision));
      const wick = Math.abs(Math.sin(i * 0.7)) * cfg.volatility * 0.9;
      const high = Number((Math.max(open, close) + wick).toFixed(info.pricePrecision));
      const low = Number((Math.min(open, close) - wick).toFixed(info.pricePrecision));
      candles.push({
        timestamp: ts,
        open,
        high,
        low,
        close,
        tickCount: 150 + ((i * 37) % 600),
      });
      price = close;
    }
    this.mids[symbol] = price;
    return candles;
  }
}

let demoState = new DemoBrokerState();

export function resetDemoState(): void {
  demoState = new DemoBrokerState();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-ratelimit-remaining-endpoint': '58',
      'x-ratelimit-remaining-global': '590',
    },
  });
}

export async function demoFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(rawUrl, 'https://demo.fortuno.local');
  const path = url.pathname.replace(/^\/api\/proxy/, '');
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;

  if (path === '/v1/platform-details' && method === 'GET') {
    return json({
      brokerName: 'Fortuno Markets (Demo Sandbox)',
      platformUrl: 'https://platform.fortunomarkets.org/',
    });
  }

  if (path === '/v1/account' && method === 'GET') {
    const account: Account = {
      login: '319642',
      name: 'FortunoAI Demo Trader',
      currency: 'USD',
      currencyPrecision: 2,
      leverage: 100,
      accessRight: 'FULL',
    };
    return json(account);
  }

  if ((path === '/v1/account-summary' || path === '/v1/account/summary') && method === 'GET') {
    return json(demoState.getSummary());
  }

  if (path === '/v1/positions' && method === 'GET') {
    demoState.getSummary();
    const filter = url.searchParams.getAll('symbol');
    const positions =
      filter.length > 0
        ? demoState.positions.filter((p) => filter.includes(p.symbol))
        : demoState.positions;
    return json({ positions });
  }

  if (path === '/v1/positions' && method === 'POST') {
    const q = demoState.getQuote(body.symbol);
    const info = DEMO_SYMBOLS.find((s) => s.symbol === body.symbol);
    const openPrice = body.side === 'BUY' ? q.ask : q.bid;
    const created: Position = {
      id: demoState.allocId(''),
      symbol: body.symbol,
      alias: info?.alias ?? body.symbol,
      side: body.side,
      volume: body.volume,
      openPrice,
      currentPrice: openPrice,
      openTime: Date.now(),
      tpPrice: body.tpPrice ?? null,
      slPrice: body.slPrice ?? null,
      swap: 0,
      commission: -Number((body.volume * 7).toFixed(2)),
      profit: 0,
      comment: body.comment ?? '',
    };
    demoState.positions.unshift(created);
    return json({ positionId: created.id }, 201);
  }

  const posCloseMatch = /^\/v1\/positions\/([^/]+)\/close$/.exec(path);
  if (posCloseMatch && method === 'POST') {
    const id = decodeURIComponent(posCloseMatch[1]!);
    const idx = demoState.positions.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const target = demoState.positions[idx]!;
      const closeVolume = Number(body?.volume ?? target.volume);
      const q = demoState.getQuote(target.symbol);
      const closePrice = target.side === 'BUY' ? q.bid : q.ask;
      const ratio = Math.min(1, closeVolume / target.volume);
      const realized = Number((target.profit * ratio).toFixed(2));
      demoState.balance = Number((demoState.balance + realized).toFixed(2));
      demoState.closedPositions.unshift({
        ...target,
        id: demoState.allocId('C'),
        volume: closeVolume,
        closePrice,
        closeTime: Date.now(),
        profit: realized,
      });
      if (closeVolume >= target.volume - 1e-8) {
        demoState.positions.splice(idx, 1);
      } else {
        target.volume = Number((target.volume - closeVolume).toFixed(2));
      }
    }
    return json({ positionId: id });
  }

  const posPatchMatch = /^\/v1\/positions\/([^/]+)$/.exec(path);
  if (posPatchMatch && method === 'PATCH') {
    const id = decodeURIComponent(posPatchMatch[1]!);
    const target = demoState.positions.find((p) => p.id === id);
    if (target) {
      if (body.tpPrice !== undefined) target.tpPrice = body.tpPrice;
      if (body.slPrice !== undefined) target.slPrice = body.slPrice;
    }
    return new Response(null, { status: 204 });
  }

  if (path === '/v1/pending-orders' && method === 'GET') {
    const filter = url.searchParams.getAll('symbol');
    const pendingOrders =
      filter.length > 0
        ? demoState.pendingOrders.filter((o) => filter.includes(o.symbol))
        : demoState.pendingOrders;
    return json({ pendingOrders });
  }

  if (path === '/v1/pending-orders' && method === 'POST') {
    const info = DEMO_SYMBOLS.find((s) => s.symbol === body.symbol);
    const created: PendingOrder = {
      id: demoState.allocId('ORD'),
      symbol: body.symbol,
      alias: info?.alias ?? body.symbol,
      type: body.type,
      side: body.side,
      volume: body.volume,
      activationPrice: body.activationPrice,
      tpPrice: body.tpPrice ?? null,
      slPrice: body.slPrice ?? null,
      createTime: Date.now(),
      comment: body.comment ?? '',
    };
    demoState.pendingOrders.unshift(created);
    return json({ orderId: created.id }, 201);
  }

  const ordMatch = /^\/v1\/pending-orders\/([^/]+)$/.exec(path);
  if (ordMatch && method === 'PATCH') {
    const id = decodeURIComponent(ordMatch[1]!);
    const target = demoState.pendingOrders.find((o) => o.id === id);
    if (target) {
      if (body.activationPrice !== undefined) target.activationPrice = body.activationPrice;
      if (body.volume !== undefined) target.volume = body.volume;
      if (body.tpPrice !== undefined) target.tpPrice = body.tpPrice;
      if (body.slPrice !== undefined) target.slPrice = body.slPrice;
    }
    return new Response(null, { status: 204 });
  }

  if (ordMatch && method === 'DELETE') {
    const id = decodeURIComponent(ordMatch[1]!);
    demoState.pendingOrders = demoState.pendingOrders.filter((o) => o.id !== id);
    return new Response(null, { status: 204 });
  }

  if (path === '/v1/symbols' && method === 'GET') {
    const types = url.searchParams.getAll('type');
    const symbols =
      types.length > 0
        ? DEMO_SYMBOLS.filter((s) => s.type && types.includes(s.type))
        : DEMO_SYMBOLS;
    return json({ symbols });
  }

  if (path === '/v1/quotes' && method === 'GET') {
    const symbols = url.searchParams.getAll('symbol');
    return json({ quotes: symbols.map((s) => demoState.getQuote(s)) });
  }

  if (path === '/v1/candles' && method === 'GET') {
    const symbol = url.searchParams.get('symbol') ?? 'EURUSD';
    const interval = (url.searchParams.get('interval') ?? 'H1') as CandleInterval;
    const limit = Number(url.searchParams.get('limit') ?? '200');
    return json({
      symbol,
      interval,
      candles: demoState.buildCandles(symbol, interval, limit),
    });
  }

  if (path === '/v1/trading-hours' && method === 'GET') {
    const symbol = url.searchParams.get('symbol') ?? 'EURUSD';
    const hours: TradingHours = {
      symbol,
      isCurrentlyOpen: true,
      sessions: [
        { dayOfWeek: 'MONDAY', open: '00:00', close: '23:59' },
        { dayOfWeek: 'TUESDAY', open: '00:00', close: '23:59' },
        { dayOfWeek: 'WEDNESDAY', open: '00:00', close: '23:59' },
        { dayOfWeek: 'THURSDAY', open: '00:00', close: '23:59' },
        { dayOfWeek: 'FRIDAY', open: '00:00', close: '21:00' },
      ],
    };
    return json(hours);
  }

  if ((path === '/v1/closed-positions' || path === '/v1/positions/history') && method === 'GET') {
    const from = Number(url.searchParams.get('from') ?? '0');
    const to = Number(url.searchParams.get('to') ?? String(Date.now()));
    const symbols = url.searchParams.getAll('symbol');
    const positions = demoState.closedPositions.filter(
      (p) =>
        p.closeTime >= from &&
        p.closeTime <= to &&
        (symbols.length === 0 || symbols.includes(p.symbol)),
    );
    return json({ positions, closedPositions: positions });
  }

  if (path === '/v1/ledgers' && method === 'GET') {
    const from = Number(url.searchParams.get('from') ?? '0');
    const to = Number(url.searchParams.get('to') ?? String(Date.now()));
    const types = url.searchParams.getAll('type');
    const ledger = demoState.ledgers.filter(
      (l) =>
        l.time >= from &&
        l.time <= to &&
        (types.length === 0 || types.includes(l.type)),
    );
    return json({ ledger });
  }

  return json({ status: 404, title: 'Not found' }, 404);
}
