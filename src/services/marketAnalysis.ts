import { AI } from '@/config/constants';
import type { FortunoClient } from '@/services/fortuno/client';
import type { AIProviderRouter } from '@/services/aiProviders';
import {
  AnalysisResultSchema,
  type AnalysisResult,
  type ChatMessage,
} from '@/types/ai';
import type { Candle, CandleInterval } from '@/types/api';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  lastValue,
} from '@/utils/indicators';

export function extractJsonObject(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = fenced?.[1]?.trim() ?? raw.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Respons AI tidak mengandung JSON yang valid');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function prepareCandleSummaryForPrompt(
  symbol: string,
  interval: CandleInterval,
  candles: readonly Candle[],
): string {
  const slice = candles.slice(-AI.analysisCandleCount);
  if (slice.length === 0) {
    return `Symbol: ${symbol} | Interval: ${interval} | Tidak ada data candle.`;
  }
  const sma20 = lastValue(calculateSMA(slice, Math.min(20, slice.length)));
  const sma50 = lastValue(calculateSMA(slice, Math.min(50, slice.length)));
  const ema20 = lastValue(calculateEMA(slice, Math.min(20, slice.length)));
  const rsi14 =
    slice.length > 14 ? lastValue(calculateRSI(slice, 14)) : 50;
  const bb = calculateBollingerBands(slice, Math.min(20, slice.length), 2);
  const last = slice[slice.length - 1]!;
  const highs = slice.map((c) => c.high);
  const lows = slice.map((c) => c.low);
  const periodHigh = Math.max(...highs);
  const periodLow = Math.min(...lows);

  const recentBars = slice
    .slice(-15)
    .map(
      (c) =>
        `${new Date(c.timestamp).toISOString().slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.tickCount}`,
    )
    .join('\n');

  return [
    `Symbol: ${symbol} | Interval: ${interval} | Candles Analyzed: ${slice.length}`,
    `Last Close: ${last.close} | Period High: ${periodHigh} | Period Low: ${periodLow}`,
    `SMA(20): ${sma20?.toFixed(5) ?? 'N/A'} | SMA(50): ${sma50?.toFixed(5) ?? 'N/A'} | EMA(20): ${ema20?.toFixed(5) ?? 'N/A'}`,
    `RSI(14): ${(rsi14 ?? 50).toFixed(2)} | Bollinger Upper: ${lastValue(bb.upper)?.toFixed(5) ?? 'N/A'} | Lower: ${lastValue(bb.lower)?.toFixed(5) ?? 'N/A'}`,
    `Recent 15 Candles:\n${recentBars}`,
  ].join('\n');
}

export function computeFallbackAnalysis(
  symbol: string,
  interval: CandleInterval,
  candles: readonly Candle[],
): AnalysisResult {
  const slice = candles.slice(-AI.analysisCandleCount);
  const last = slice[slice.length - 1];
  const close = last?.close ?? 1;
  const sma20 = lastValue(calculateSMA(slice, Math.min(20, Math.max(1, slice.length)))) ?? close;
  const sma50 = lastValue(calculateSMA(slice, Math.min(50, Math.max(1, slice.length)))) ?? close;
  const rsi = slice.length > 14 ? (lastValue(calculateRSI(slice, 14)) ?? 50) : 50;
  const recentSlice = slice.slice(-30);
  const low = recentSlice.length > 0 ? Math.min(...recentSlice.map((c) => c.low)) : close * 0.995;
  const high = recentSlice.length > 0 ? Math.max(...recentSlice.map((c) => c.high)) : close * 1.005;
  const range = Math.max(high - low, close * 0.002);

  const uptrend = close > sma20 && sma20 >= sma50;
  const downtrend = close < sma20 && sma20 <= sma50;
  const trend = uptrend ? 'UPTREND' : downtrend ? 'DOWNTREND' : 'SIDEWAYS';
  const signal =
    uptrend && rsi < 70
      ? 'BUY'
      : downtrend && rsi > 30
        ? 'SELL'
        : 'HOLD';

  return {
    symbol,
    interval,
    analyzedAt: Date.now(),
    trend,
    signal,
    strength: signal === 'HOLD' ? 2 : 4,
    confidence: signal === 'HOLD' ? 'LOW' : 'MEDIUM',
    supportLevels: [Number(low.toFixed(5)), Number((low - range * 0.35).toFixed(5))],
    resistanceLevels: [Number(high.toFixed(5)), Number((high + range * 0.35).toFixed(5))],
    entryPrice: close,
    tpPrice:
      signal === 'BUY'
        ? Number((close + range * 0.8).toFixed(5))
        : signal === 'SELL'
          ? Number((close - range * 0.8).toFixed(5))
          : null,
    slPrice:
      signal === 'BUY'
        ? Number((close - range * 0.5).toFixed(5))
        : signal === 'SELL'
          ? Number((close + range * 0.5).toFixed(5))
          : null,
    reasoning: `Analisis teknikal kuantitatif (${interval}): harga penutupan ${close} berada ${close >= sma20 ? 'di atas' : 'di bawah'} SMA(20) (${sma20.toFixed(5)}) dengan RSI(14) di ${rsi.toFixed(1)}.`,
  };
}

export function parseAnalysisResponse(
  raw: string,
  symbol: string,
  interval: CandleInterval,
  candles: readonly Candle[],
): AnalysisResult {
  try {
    const parsed = AnalysisResultSchema.parse(extractJsonObject(raw));
    return {
      ...parsed,
      symbol,
      interval,
      analyzedAt: Date.now(),
    };
  } catch {
    return computeFallbackAnalysis(symbol, interval, candles);
  }
}

export async function analyzeSymbolWithAI(params: {
  symbol: string;
  interval: CandleInterval;
  providerId: string;
  router: AIProviderRouter;
  apiClient: FortunoClient;
  allowDemoFallback?: boolean;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  const candles = await params.apiClient.getCandles(params.symbol, params.interval, {
    limit: AI.analysisCandleCount,
    signal: params.signal,
  });
  const summary = prepareCandleSummaryForPrompt(params.symbol, params.interval, candles);

  const messages: ChatMessage[] = [
    {
      id: 'sys',
      role: 'system',
      createdAt: Date.now(),
      content:
        'Kamu adalah analis teknikal pasar finansial profesional. Balas HANYA dengan JSON valid sesuai skema yang diminta tanpa teks tambahan.',
    },
    {
      id: 'usr',
      role: 'user',
      createdAt: Date.now(),
      content: `Analisis data pasar berikut dan kembalikan JSON dengan field:
{
  "trend": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
  "signal": "BUY" | "SELL" | "HOLD" | "WAIT",
  "strength": 1..5,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "supportLevels": [number, number],
  "resistanceLevels": [number, number],
  "entryPrice": number | null,
  "tpPrice": number | null,
  "slPrice": number | null,
  "reasoning": "penjelasan 2-3 kalimat bahasa Indonesia"
}

Data Pasar:
${summary}`,
    },
  ];

  const response = await params.router.chat(params.providerId, messages, {
    temperature: 0.2,
    allowDemoFallback: params.allowDemoFallback,
    signal: params.signal,
  });

  return parseAnalysisResponse(response.content, params.symbol, params.interval, candles);
}

