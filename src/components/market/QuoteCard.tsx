'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, X } from 'lucide-react';

import type { Quote, SymbolInfo } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/formatters';
import { getSpreadPips } from '@/utils/tradingCalculations';

export interface QuoteCardProps {
  readonly symbol: string;
  readonly quote: Quote | undefined;
  readonly previousQuote?: Quote | undefined;
  readonly symbolInfo?: SymbolInfo | undefined;
  readonly isSelected?: boolean;
  readonly onSelect: (symbol: string) => void;
  readonly onRemove?: ((symbol: string) => void) | undefined;
  readonly onMoveUp?: (() => void) | undefined;
  readonly onMoveDown?: (() => void) | undefined;
  readonly canMoveUp?: boolean | undefined;
  readonly canMoveDown?: boolean | undefined;
}

export function QuoteCard({
  symbol,
  quote,
  previousQuote,
  symbolInfo,
  isSelected = false,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: QuoteCardProps): React.ReactElement {
  const precision = symbolInfo?.pricePrecision ?? 5;
  const prevBidRef = React.useRef<number | undefined>(quote?.bid);
  const [direction, setDirection] = React.useState<'up' | 'down' | 'flat'>('flat');
  const [flashKey, setFlashKey] = React.useState(0);

  React.useEffect(() => {
    if (quote?.bid === undefined) return;
    if (prevBidRef.current !== undefined && quote.bid !== prevBidRef.current) {
      setDirection(quote.bid > prevBidRef.current ? 'up' : 'down');
      setFlashKey((k) => k + 1);
    }
    prevBidRef.current = quote.bid;
  }, [quote?.bid]);

  const spreadPips = React.useMemo(() => {
    if (!quote) return null;
    return getSpreadPips(quote, precision);
  }, [quote, precision]);

  const changePct = React.useMemo(() => {
    if (!quote || !previousQuote || previousQuote.bid <= 0) return null;
    return ((quote.bid - previousQuote.bid) / previousQuote.bid) * 100;
  }, [quote, previousQuote]);

  return (
    <div
      key={flashKey}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(symbol)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(symbol);
        }
      }}
      className={cn(
        'group relative flex flex-col justify-between rounded-lg border p-3 transition-all cursor-pointer select-none',
        isSelected
          ? 'border-blue-500/70 bg-blue-500/10 shadow-sm'
          : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900',
        direction === 'up' && flashKey > 0 && 'animate-flash-up',
        direction === 'down' && flashKey > 0 && 'animate-flash-down',
      )}
      aria-label={`Select ${symbol}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs tracking-wide text-slate-100 truncate">
              {symbolInfo?.alias || symbol}
            </span>
            {direction === 'up' && <ArrowUp className="h-3 w-3 text-emerald-400 shrink-0" />}
            {direction === 'down' && <ArrowDown className="h-3 w-3 text-rose-400 shrink-0" />}
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {symbolInfo?.type ?? symbol}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          {spreadPips !== null && (
            <span
              className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
              title="Spread in pips"
            >
              {spreadPips.toFixed(1)}p
            </span>
          )}
          <div
            className="hidden group-hover:flex items-center gap-0.5 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onMoveUp && (
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
                aria-label={`Move ${symbol} up`}
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
                aria-label={`Move ${symbol} down`}
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(symbol)}
                className="rounded p-0.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                aria-label={`Remove ${symbol} from watchlist`}
                title="Remove from watchlist"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {quote ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
          <div>
            <span className="block text-[9px] uppercase tracking-wider text-slate-400">Bid (Sell)</span>
            <span className="font-mono text-xs font-semibold text-rose-400">
              {formatPrice(quote.bid, precision)}
            </span>
          </div>
          <div className="text-right">
            <span className="block text-[9px] uppercase tracking-wider text-slate-400">Ask (Buy)</span>
            <span className="font-mono text-xs font-semibold text-emerald-400">
              {formatPrice(quote.ask, precision)}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
          <span>Waiting for quote…</span>
          {changePct !== null && (
            <span className="font-mono">
              {changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
