'use client';

import * as React from 'react';
import { Plus, RefreshCw, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useQuotes } from '@/hooks/useQuotes';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';

import { QuoteCard } from './QuoteCard';

export interface WatchlistWidgetProps {
  readonly onSelectSymbol?: (symbol: string) => void;
  readonly compact?: boolean;
}

export function WatchlistWidget({
  onSelectSymbol,
  compact = false,
}: WatchlistWidgetProps): React.ReactElement {
  const watchlist = useConfigStore((s) => s.watchlist);
  const addToWatchlist = useConfigStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useConfigStore((s) => s.removeFromWatchlist);
  const reorderWatchlist = useConfigStore((s) => s.reorderWatchlist);

  const selectedSymbol = useConfigStore((s) => s.defaultSymbol);
  const setSelectedSymbol = useConfigStore((s) => s.setDefaultSymbol);

  const { symbols } = useSymbols();
  const { quotes, previousQuotes, loading, refresh } = useQuotes(watchlist, false);

  const [symbolToAdd, setSymbolToAdd] = React.useState<string>('');

  const symbolMap = React.useMemo(
    () => new Map(symbols.map((s) => [s.symbol, s])),
    [symbols],
  );

  const availableToAdd = React.useMemo(
    () => symbols.filter((s) => !watchlist.includes(s.symbol)),
    [symbols, watchlist],
  );

  const handleSelect = (symbol: string): void => {
    setSelectedSymbol(symbol);
    onSelectSymbol?.(symbol);
  };

  const handleAdd = (): void => {
    const target = symbolToAdd || availableToAdd[0]?.symbol;
    if (!target) return;
    addToWatchlist(target);
    setSymbolToAdd('');
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <CardTitle className="text-sm font-semibold">Watchlist ({watchlist.length})</CardTitle>
        </div>

        <div className="flex items-center gap-1.5">
          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-1">
              <Select
                aria-label="Add symbol to watchlist"
                value={symbolToAdd}
                onChange={(e) => setSymbolToAdd(e.target.value)}
                className="h-7 text-xs w-36 py-0.5 px-2"
              >
                <option value="">+ Add Symbol…</option>
                {availableToAdd.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.alias || s.symbol} ({s.type ?? 'INSTRUMENT'})
                  </option>
                ))}
              </Select>
              {symbolToAdd && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAdd}
                  aria-label="Confirm add symbol"
                  className="h-7 px-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void refresh()}
            aria-label="Refresh quotes"
            title="Refresh quotes"
            className="h-7 w-7"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {watchlist.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
            Watchlist is empty. Use the selector above to add trading instruments.
          </div>
        ) : (
          <div
            className={
              compact
                ? 'grid grid-cols-1 gap-2 sm:grid-cols-2'
                : 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }
          >
            {watchlist.map((sym, index) => (
              <QuoteCard
                key={sym}
                symbol={sym}
                quote={quotes[sym]}
                previousQuote={previousQuotes[sym]}
                symbolInfo={symbolMap.get(sym)}
                isSelected={selectedSymbol === sym}
                onSelect={handleSelect}
                onRemove={removeFromWatchlist}
                canMoveUp={index > 0}
                canMoveDown={index < watchlist.length - 1}
                onMoveUp={() => reorderWatchlist(index, index - 1)}
                onMoveDown={() => reorderWatchlist(index, index + 1)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
