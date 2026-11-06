'use client';

import * as React from 'react';
import { Loader2, Radar, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { CANDLE_INTERVALS } from '@/config/market';
import { useAI } from '@/hooks/useAI';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import type { AnalysisResult } from '@/types/ai';
import type { CandleInterval } from '@/types/api';

import { SignalCard } from './SignalCard';

export interface MultiSignalGridProps {
  readonly onTradeSignal?: (result: AnalysisResult) => void;
}

export function MultiSignalGrid({ onTradeSignal }: MultiSignalGridProps): React.ReactElement {
  const watchlist = useConfigStore((s) => s.watchlist);
  const { analysisResults, isAnalyzing, runMarketAnalysis } = useAI();
  const { symbols } = useSymbols();

  const [interval, setInterval] = React.useState<CandleInterval>('H1');
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [scanningSymbol, setScanningSymbol] = React.useState<string | null>(null);

  const symbolMap = React.useMemo(
    () => new Map(symbols.map((s) => [s.symbol, s])),
    [symbols],
  );

  const scanAll = React.useCallback(async () => {
    for (const sym of watchlist) {
      setScanningSymbol(sym);
      try {
        await runMarketAnalysis(sym, interval);
      } catch {
        // Continue scanning remaining symbols
      }
    }
    setScanningSymbol(null);
  }, [watchlist, interval, runMarketAnalysis]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void scanAll();
    }, 300_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, scanAll]);

  const cards = watchlist
    .map((sym) => analysisResults[sym.toUpperCase()])
    .filter((r): r is AnalysisResult => Boolean(r));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-emerald-400" />
          <div>
            <CardTitle className="text-sm font-semibold">
              Multi-Symbol AI Signal Scanner ({watchlist.length} Instruments)
            </CardTitle>
            <p className="text-[11px] text-slate-400">
              Batch technical + AI structure scan across your active watchlist
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Scanner timeframe"
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

          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-700"
            />
            <span>Auto-refresh (5m)</span>
          </label>

          <Button
            size="sm"
            variant="default"
            disabled={isAnalyzing || scanningSymbol !== null}
            onClick={() => void scanAll()}
            className="h-8 text-xs"
          >
            {scanningSymbol ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Scanning {scanningSymbol}…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Scan All Watchlist
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
            Click <strong>Scan All Watchlist</strong> to generate AI trading signals across your{' '}
            {watchlist.length} watched instruments.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((res) => (
              <SignalCard
                key={res.symbol}
                result={res}
                precision={symbolMap.get(res.symbol)?.pricePrecision ?? 5}
                onTradeSignal={onTradeSignal}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
