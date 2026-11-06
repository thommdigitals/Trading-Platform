import { CHAT } from '@/config/constants';
import type {
  Account,
  AccountSummary,
  PendingOrder,
  Position,
  Quote,
} from '@/types/api';

export interface TradingContextInput {
  account: Account | null;
  accountSummary: AccountSummary | null;
  positions: readonly Position[];
  pendingOrders: readonly PendingOrder[];
  quotes: Record<string, Quote>;
}

/** Rough token estimator (~4 chars per token for English/Indonesian + numbers). */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function buildAccountSummary(
  account: Account | null,
  summary: AccountSummary | null,
): string {
  if (!account || !summary) {
    return 'Akun belum terhubung.';
  }
  const precision = account.currencyPrecision ?? 2;
  const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(precision));
  const sign = summary.floatingProfit >= 0 ? '+' : '';
  return [
    `Login: ${account.login} | Nama: ${account.name || '-'} | Currency: ${account.currency} | Leverage: 1:${account.leverage} | Status: ${account.accessRight}`,
    `Balance: ${fmt(summary.balance)} ${account.currency} | Equity: ${fmt(summary.equity)} ${account.currency}`,
    `Margin: ${fmt(summary.margin)} ${account.currency} | Free Margin: ${fmt(summary.freeMargin)} ${account.currency} | Margin Level: ${summary.marginLevel !== null ? `${summary.marginLevel.toFixed(2)}%` : '—'}`,
    `Floating P&L: ${sign}${fmt(summary.floatingProfit)} ${account.currency}`,
  ].join('\n');
}

export function buildPositionsSummary(
  positions: readonly Position[],
  currency = 'USD',
): string {
  if (positions.length === 0) return 'Tidak ada posisi terbuka.';
  const slice = positions.slice(0, CHAT.maxContextPositions);
  const lines = slice.map((p) => {
    const sign = p.profit >= 0 ? '+' : '';
    return `  - ID:${p.id} | ${p.side} ${p.symbol} | ${p.volume} lot | Open:${p.openPrice} | Harga:${p.currentPrice ?? '-'} | TP:${p.tpPrice ?? '-'} | SL:${p.slPrice ?? '-'} | P&L: ${sign}${p.profit.toFixed(2)} ${currency}`;
  });
  if (positions.length > slice.length) {
    lines.push(`  ...dan ${positions.length - slice.length} posisi lainnya.`);
  }
  return lines.join('\n');
}

export function buildPendingOrdersSummary(orders: readonly PendingOrder[]): string {
  if (orders.length === 0) return 'Tidak ada pending order.';
  const slice = orders.slice(0, CHAT.maxContextOrders);
  const lines = slice.map(
    (o) =>
      `  - ID:${o.id} | ${o.type} ${o.side} ${o.symbol} | ${o.volume} lot @ ${o.activationPrice} | TP:${o.tpPrice ?? '-'} | SL:${o.slPrice ?? '-'}`,
  );
  if (orders.length > slice.length) {
    lines.push(`  ...dan ${orders.length - slice.length} pending order lainnya.`);
  }
  return lines.join('\n');
}

export function buildQuotesSummary(quotes: readonly Quote[] | Record<string, Quote>): string {
  const list = Array.isArray(quotes) ? quotes : Object.values(quotes);
  if (list.length === 0) return 'Belum ada quote aktif.';
  return list
    .slice(0, 25)
    .map((q) => `  - ${q.symbol}: Bid ${q.bid} / Ask ${q.ask} (Spread ${(q.ask - q.bid).toPrecision(3)})`)
    .join('\n');
}

export function buildSystemPrompt(state: TradingContextInput): string {
  if (!state.account || !state.accountSummary) {
    return 'Kamu adalah AI trading assistant FortunoAI. Koneksi ke akun trading belum tersedia.';
  }
  const currency = state.account.currency;
  const full = `Kamu adalah AI trading assistant yang terhubung ke akun trading Fortuno Markets.

[INFORMASI & RINGKASAN AKUN]
${buildAccountSummary(state.account, state.accountSummary)}

[POSISI TERBUKA (${state.positions.length})]
${buildPositionsSummary(state.positions, currency)}

[PENDING ORDERS (${state.pendingOrders.length})]
${buildPendingOrdersSummary(state.pendingOrders)}

[HARGA PASAR TERKINI]
${buildQuotesSummary(state.quotes)}

Instruksi:
- Berikan analisis dan rekomendasi berdasarkan data real-time di atas.
- Jika pengguna meminta eksekusi order, gunakan tool yang sesuai; sistem akan meminta konfirmasi pengguna sebelum order dikirim ke broker.
- Gunakan bahasa Indonesia yang jelas, terstruktur, dan mudah dipahami.
- Sertakan reasoning teknikal & manajemen risiko untuk setiap rekomendasi.`;

  return full.length > CHAT.maxContextChars ? `${full.slice(0, CHAT.maxContextChars)}\n...[truncated]` : full;
}

export const buildTradingSystemPrompt = buildSystemPrompt;

