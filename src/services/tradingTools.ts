import { z } from 'zod';
import { AI } from '@/config/constants';
import { CANDLE_INTERVALS, PENDING_ORDER_TYPES, POSITION_SIDES } from '@/config/market';
import type { FortunoClient } from '@/services/fortuno/client';
import type { AITool, PendingToolApproval, ToolCall } from '@/types/ai';

export const TRADING_TOOLS: readonly AITool[] = [
  {
    name: 'open_position',
    description:
      'Membuka posisi trading baru (BUY atau SELL) di pasar. Eksekusi dilakukan setelah dikonfirmasi pengguna.',
    parameters: {
      type: 'object',
      required: ['symbol', 'side', 'volume'],
      properties: {
        symbol: { type: 'string', description: 'Nama instrumen, contoh: EURUSD, XAUUSD' },
        side: { type: 'string', enum: ['BUY', 'SELL'], description: 'Arah order' },
        volume: { type: 'number', description: 'Volume dalam lot' },
        tpPrice: { type: 'number', description: 'Take profit price (opsional)' },
        slPrice: { type: 'number', description: 'Stop loss price (opsional)' },
        comment: { type: 'string', description: 'Catatan order (opsional)' },
      },
    },
  },
  {
    name: 'close_position',
    description: 'Menutup posisi trading yang sedang terbuka (full atau partial).',
    parameters: {
      type: 'object',
      required: ['positionId', 'volume'],
      properties: {
        positionId: { type: 'string', description: 'ID posisi yang ingin ditutup' },
        volume: { type: 'number', description: 'Volume yang ingin ditutup' },
      },
    },
  },
  {
    name: 'modify_position',
    description: 'Memodifikasi Take Profit dan/atau Stop Loss pada posisi terbuka.',
    parameters: {
      type: 'object',
      required: ['positionId'],
      properties: {
        positionId: { type: 'string', description: 'ID posisi' },
        tpPrice: { type: ['number', 'null'], description: 'Take profit baru (null untuk hapus)' },
        slPrice: { type: ['number', 'null'], description: 'Stop loss baru (null untuk hapus)' },
      },
    },
  },
  {
    name: 'create_pending_order',
    description: 'Membuat pending order (LIMIT atau STOP).',
    parameters: {
      type: 'object',
      required: ['symbol', 'side', 'type', 'volume', 'activationPrice'],
      properties: {
        symbol: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        type: { type: 'string', enum: ['LIMIT', 'STOP'] },
        volume: { type: 'number' },
        activationPrice: { type: 'number' },
        tpPrice: { type: 'number' },
        slPrice: { type: 'number' },
        comment: { type: 'string' },
      },
    },
  },
  {
    name: 'cancel_pending_order',
    description: 'Membatalkan pending order yang belum aktif.',
    parameters: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string', description: 'ID pending order' },
      },
    },
  },
  {
    name: 'get_quote',
    description: 'Mengambil harga bid/ask terkini untuk satu atau beberapa simbol.',
    parameters: {
      type: 'object',
      required: ['symbols'],
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Daftar simbol, misal ["EURUSD", "XAUUSD"]',
        },
      },
    },
  },
  {
    name: 'get_market_analysis',
    description: 'Mengambil ringkasan data candle OHLC untuk analisis teknikal.',
    parameters: {
      type: 'object',
      required: ['symbol', 'interval'],
      properties: {
        symbol: { type: 'string' },
        interval: { type: 'string', enum: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'] },
        limit: { type: 'number', description: 'Jumlah candle (default 100, maks 200)' },
      },
    },
  },
];

const MUTATING_TOOLS = new Set([
  'open_position',
  'close_position',
  'modify_position',
  'create_pending_order',
  'cancel_pending_order',
]);

/** Read-only tools (`get_quote`, `get_market_analysis`) can run immediately; trading tools require confirmation. */
export function requiresUserConfirmation(toolName: string): boolean {
  return MUTATING_TOOLS.has(toolName);
}

export function describeToolCall(call: ToolCall): PendingToolApproval {
  const args = call.arguments;
  switch (call.name) {
    case 'open_position': {
      const side = String(args.side ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
      const symbol = String(args.symbol ?? '');
      const volume = Number(args.volume ?? 0);
      const tp = args.tpPrice ? ` | TP: ${args.tpPrice}` : '';
      const sl = args.slPrice ? ` | SL: ${args.slPrice}` : '';
      return {
        call,
        side,
        summary: `Buka posisi ${side} ${symbol} sebesar ${volume} lot${tp}${sl}`,
      };
    }
    case 'close_position':
      return {
        call,
        summary: `Tutup posisi #${String(args.positionId ?? '')} sebesar ${String(args.volume ?? '')} lot`,
      };
    case 'modify_position':
      return {
        call,
        summary: `Ubah TP/SL posisi #${String(args.positionId ?? '')} (TP: ${String(args.tpPrice ?? 'tetap')}, SL: ${String(args.slPrice ?? 'tetap')})`,
      };
    case 'create_pending_order': {
      const side = String(args.side ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
      return {
        call,
        side,
        summary: `Buat pending order ${side} ${String(args.type ?? 'LIMIT')} ${String(args.symbol ?? '')} ${String(args.volume ?? '')} lot @ ${String(args.activationPrice ?? '')}`,
      };
    }
    case 'cancel_pending_order':
      return {
        call,
        summary: `Batalkan pending order #${String(args.orderId ?? '')}`,
      };
    default:
      return {
        call,
        summary: `Jalankan perintah ${call.name}`,
      };
  }
}

const OpenArgsSchema = z.object({
  symbol: z.string().trim().min(1),
  side: z.enum(POSITION_SIDES),
  volume: z.coerce.number().positive().max(AI.maxTradingToolVolume),
  tpPrice: z.coerce.number().positive().nullish(),
  slPrice: z.coerce.number().positive().nullish(),
  comment: z.string().max(128).optional(),
});

const CloseArgsSchema = z.object({
  positionId: z.string().trim().min(1),
  volume: z.coerce.number().positive().max(AI.maxTradingToolVolume),
});

const ModifyArgsSchema = z.object({
  positionId: z.string().trim().min(1),
  tpPrice: z.coerce.number().positive().nullable().optional(),
  slPrice: z.coerce.number().positive().nullable().optional(),
});

const CreateOrderArgsSchema = z.object({
  symbol: z.string().trim().min(1),
  side: z.enum(POSITION_SIDES),
  type: z.enum(PENDING_ORDER_TYPES),
  volume: z.coerce.number().positive().max(AI.maxTradingToolVolume),
  activationPrice: z.coerce.number().positive(),
  tpPrice: z.coerce.number().positive().nullish(),
  slPrice: z.coerce.number().positive().nullish(),
  comment: z.string().max(128).optional(),
});

const CancelOrderArgsSchema = z.object({
  orderId: z.string().trim().min(1),
});

const QuoteArgsSchema = z.object({
  symbols: z.array(z.string().trim().min(1)).min(1).max(20),
});

const AnalysisArgsSchema = z.object({
  symbol: z.string().trim().min(1),
  interval: z.enum(CANDLE_INTERVALS),
  limit: z.coerce.number().int().min(10).max(200).optional(),
});

export async function executeTradingTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
  apiClient: FortunoClient,
): Promise<string> {
  switch (toolName) {
    case 'open_position': {
      const args = OpenArgsSchema.parse({
        ...rawArgs,
        symbol: String(rawArgs.symbol ?? '').toUpperCase(),
        side: String(rawArgs.side ?? '').toUpperCase(),
      });
      const res = await apiClient.openPosition(args);
      return `Posisi ${args.side} ${args.symbol} (${args.volume} lot) berhasil dibuka. Position ID: ${res.positionId}`;
    }
    case 'close_position': {
      const args = CloseArgsSchema.parse(rawArgs);
      await apiClient.closePosition(args.positionId, args.volume);
      return `Posisi #${args.positionId} sebesar ${args.volume} lot berhasil ditutup.`;
    }
    case 'modify_position': {
      const args = ModifyArgsSchema.parse(rawArgs);
      await apiClient.updatePosition(args.positionId, {
        tpPrice: args.tpPrice,
        slPrice: args.slPrice,
      });
      return `TP/SL posisi #${args.positionId} berhasil diperbarui.`;
    }
    case 'create_pending_order': {
      const args = CreateOrderArgsSchema.parse({
        ...rawArgs,
        symbol: String(rawArgs.symbol ?? '').toUpperCase(),
        side: String(rawArgs.side ?? '').toUpperCase(),
        type: String(rawArgs.type ?? '').toUpperCase(),
      });
      const res = await apiClient.createPendingOrder(args);
      return `Pending order ${args.side} ${args.type} ${args.symbol} berhasil dibuat. Order ID: ${res.orderId}`;
    }
    case 'cancel_pending_order': {
      const args = CancelOrderArgsSchema.parse(rawArgs);
      await apiClient.cancelPendingOrder(args.orderId);
      return `Pending order #${args.orderId} berhasil dibatalkan.`;
    }
    case 'get_quote':
    case 'get_current_quote': {
      const symbolsInput = Array.isArray(rawArgs.symbols)
        ? rawArgs.symbols
        : typeof rawArgs.symbol === 'string'
          ? [rawArgs.symbol]
          : [];
      const args = QuoteArgsSchema.parse({
        symbols: symbolsInput.map((s) => String(s).toUpperCase()),
      });
      const quotes = await apiClient.getQuotes(args.symbols);
      return JSON.stringify(quotes);
    }
    case 'get_market_analysis': {
      const args = AnalysisArgsSchema.parse({
        ...rawArgs,
        symbol: String(rawArgs.symbol ?? '').toUpperCase(),
        interval: String(rawArgs.interval ?? 'H1').toUpperCase(),
      });
      const candles = await apiClient.getCandles(args.symbol, args.interval, {
        limit: args.limit ?? 100,
      });
      const last = candles[candles.length - 1];
      return `Candle ${args.symbol} (${args.interval}): ${candles.length} bar. Last OHLC: O=${last?.open ?? '-'} H=${last?.high ?? '-'} L=${last?.low ?? '-'} C=${last?.close ?? '-'}`;
    }
    default:
      throw new Error(`Tool "${toolName}" tidak dikenali`);
  }
}
