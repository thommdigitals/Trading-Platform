'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { CANDLE_INTERVALS } from '@/config/market';
import { useAI } from '@/hooks/useAI';
import { useCandles } from '@/hooks/useCandles';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import type { AnalysisResult } from '@/types/ai';
import type { CandleInterval } from '@/types/api';
import { formatPrice } from '@/utils/formatters';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  lastValue,
} from '@/utils/indicators';

import { SignalCard } from './SignalCard';

export interface MarketAnalysisPanelProps {
  readonly onTradeSignal?: (result: AnalysisResult) => void;
}

export function MarketAnalysisPanel({
  onTradeSignal,
}: MarketAnalysisPanelProps): React.ReactElement {
  const defaultSymbol = useConfigStore((s) => s.defaultSymbol);
  const defaultInterval = useConfigStore((s) => s.defaultInterval);

  const [symbol, setSymbol] = React.useState(defaultSymbol);
  const [interval, setInterval] = React.useState<CandleInterval>(defaultInterval);
  const [error, setError] = React.useState<string | null>(null);

  const { symbols } = useSymbols();
  const { candles } = useCandles(symbol, interval);
  const { analysisResults, isAnalyzing, runMarketAnalysis } = useAI();

  const symbolInfo = React.useMemo(
    () => symbols.find((s) => s.symbol === symbol),
    [symbols, symbol],
  );
  const precision = symbolInfo?.pricePrecision ?? 5;

  const indicators = React.useMemo(() => {
    if (candles.length === 0) return null;
    const sma20 = lastValue(calculateSMA(candles, 20));
    const sma50 = lastValue(calculateSMA(candles, 50));
    const ema20 = lastValue(calculateEMA(candles, 20));
    const rsi14 = lastValue(calculateRSI(candles, 14));
    const bb = calculateBollingerBands(candles, 20, 2);
    return {
      sma20,
      sma50,
      ema20,
      rsi14,
      bbUpper: lastValue(bb.upper),
      bbMiddle: lastValue(bb.middle),
      bbLower: lastValue(bb.lower),
    };
  }, [candles]);

  const handleAnalyze = async (): Promise<void> => {
    setError(null);
    try {
      await runMarketAnalysis(symbol, interval);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze symbol');
    }
  };

  const currentResult = analysisResults[symbol.toUpperCase()];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">
            Deep Single-Instrument AI Technical Analysis
          </CardTitle>
          <p className="text-[11px] text-slate-400">
            Combines OHLCV candle geometry, SMA/EMA/RSI/Bollinger Bands &amp; LLM market reasoning
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Analysis symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="h-8 w-36 font-semibold text-xs py-0.5 px-2"
          >
            {symbols.length > 0 ? (
              symbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.alias || s.symbol}
                </option>
              ))
            ) : (
              <option value={symbol}>{symbol}</option>
            )}
          </Select>

          <Select
            aria-label="Analysis timeframe"
            value={interval}
            onChange={(e) => setInterval(e.target.value as CandleInterval)}
            className="h-8 w-24 font-mono text-xs py-0.5 px-2"
          >
            {CANDLE_INTERVALS.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </Select>

          <Button
            size="sm"
            variant="default"
            disabled={isAnalyzing}
            onClick={() => void handleAnalyze()}
            className="h-8 text-xs"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Analyze Market
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {indicators && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 font-mono text-xs">
            <div>
              <span className="block text-[10px] text-slate-400">SMA(20)</span>
              <span className="font-semibold text-sky-400">
                {formatPrice(indicators.sma20, precision)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">SMA(50)</span>
              <span className="font-semibold text-amber-400">
                {formatPrice(indicators.sma50, precision)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">EMA(20)</span>
              <span className="font-semibold text-purple-400">
                {formatPrice(indicators.ema20, precision)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">RSI(14)</span>
              <span
                className={`font-semibold ${
                  (indicators.rsi14 ?? 50) >= 70
                    ? 'text-rose-400'
                    : (indicators.rsi14 ?? 50) <= 30
                      ? 'text-emerald-400'
                      : 'text-slate-100'
                }`}
              >
                {indicators.rsi14 !== null ? indicators.rsi14.toFixed(2) : '—'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">BB Upper(20,2)</span>
              <span className="font-semibold text-slate-200">
                {formatPrice(indicators.bbUpper, precision)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">BB Lower(20,2)</span>
              <span className="font-semibold text-slate-200">
                {formatPrice(indicators.bbLower, precision)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {currentResult ? (
          <SignalCard
            result={currentResult}
            precision={precision}
            onTradeSignal={onTradeSignal}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
            Select an instrument &amp; timeframe above, then click <strong>Analyze Market</strong>{' '}
            to generate structured AI trade signals, support/resistance levels, and TP/SL targets.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
