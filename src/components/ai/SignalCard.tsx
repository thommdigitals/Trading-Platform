'use client';

import * as React from 'react';
import { ArrowRight, Star, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalysisResult } from '@/types/ai';
import { formatTime } from '@/utils/dateTime';
import { formatPrice } from '@/utils/formatters';

export interface SignalCardProps {
  readonly result: AnalysisResult;
  readonly precision?: number;
  readonly onTradeSignal?: (result: AnalysisResult) => void;
}

export function SignalCard({
  result,
  precision = 5,
  onTradeSignal,
}: SignalCardProps): React.ReactElement {
  const signalVariant =
    result.signal === 'BUY'
      ? 'success'
      : result.signal === 'SELL'
        ? 'danger'
        : 'secondary';

  return (
    <Card className="flex flex-col justify-between border-slate-800/80 bg-slate-900/60">
      <CardHeader className="pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">{result.symbol}</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                {result.interval}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              {result.trend === 'UPTREND' && (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              )}
              {result.trend === 'DOWNTREND' && (
                <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              )}
              <span>{result.trend}</span>
              <span>•</span>
              <span>Confidence: {result.confidence}</span>
            </div>
          </div>

          <Badge variant={signalVariant} className="text-xs px-2.5 py-0.5">
            {result.signal}
          </Badge>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-0.5" aria-label={`Strength ${result.strength} of 5`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3.5 w-3.5 ${
                  star <= result.strength
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-700'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-500">
            Updated {formatTime(result.analyzedAt)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 text-xs">
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 font-mono text-[11px]">
          <div>
            <span className="block text-[9px] uppercase text-slate-400">Entry</span>
            <span className="font-semibold text-slate-100">
              {result.entryPrice ? formatPrice(result.entryPrice, precision) : 'Market'}
            </span>
          </div>
          <div>
            <span className="block text-[9px] uppercase text-emerald-400">Take Profit</span>
            <span className="font-semibold text-emerald-400">
              {result.tpPrice ? formatPrice(result.tpPrice, precision) : '—'}
            </span>
          </div>
          <div>
            <span className="block text-[9px] uppercase text-rose-400">Stop Loss</span>
            <span className="font-semibold text-rose-400">
              {result.slPrice ? formatPrice(result.slPrice, precision) : '—'}
            </span>
          </div>
        </div>

        {(result.supportLevels.length > 0 || result.resistanceLevels.length > 0) && (
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="rounded border border-slate-800/70 bg-slate-950/40 p-2">
              <span className="block text-[9px] uppercase text-slate-400">Support</span>
              <span className="text-emerald-300">
                {result.supportLevels.map((l) => formatPrice(l, precision)).join(', ') || '—'}
              </span>
            </div>
            <div className="rounded border border-slate-800/70 bg-slate-950/40 p-2">
              <span className="block text-[9px] uppercase text-slate-400">Resistance</span>
              <span className="text-rose-300">
                {result.resistanceLevels.map((l) => formatPrice(l, precision)).join(', ') || '—'}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-300">{result.reasoning}</p>

        {onTradeSignal && (result.signal === 'BUY' || result.signal === 'SELL') && (
          <Button
            size="sm"
            variant={result.signal === 'BUY' ? 'buy' : 'sell'}
            onClick={() => onTradeSignal(result)}
            className="w-full h-8 text-xs"
          >
            Trade This Signal ({result.signal} {result.symbol})
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

