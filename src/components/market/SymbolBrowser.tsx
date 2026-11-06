'use client';

import * as React from 'react';
import { Search, Star, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { formatPrice } from '@/utils/formatters';
import { getSpreadPips } from '@/utils/tradingCalculations';

export interface SymbolBrowserProps {
  readonly onSelectTrade?: (symbol: string) => void;
}

const CATEGORIES = ['ALL', 'FAVORIT', 'FOREX', 'CRYPTO', 'COMMODITY', 'INDEX', 'STOCK'] as const;

export function SymbolBrowser({ onSelectTrade }: SymbolBrowserProps): React.ReactElement {
  const { symbols, loading } = useSymbols();
  const quotes = useTradingStore((s) => s.quotes);
  const setSelectedSymbol = useConfigStore((s) => s.setDefaultSymbol);
  const watchlist = useConfigStore((s) => s.watchlist);
  const toggleFavoriteSymbol = useConfigStore((s) => s.toggleFavoriteSymbol);

  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<string>('ALL');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return symbols.filter((s) => {
      if (category === 'FAVORIT') {
        if (!watchlist.includes(s.symbol)) return false;
      } else {
        const catMatch = category === 'ALL' || (s.type ?? '').toUpperCase() === category;
        if (!catMatch) return false;
      }
      if (!q) return true;
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.alias.toLowerCase().includes(q) ||
        (s.type ?? '').toLowerCase().includes(q)
      );
    });
  }, [symbols, query, category, watchlist]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
        <CardTitle className="text-sm font-semibold">
          Instruments Catalog ({filtered.length})
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              aria-label="Search instruments"
              placeholder="Search symbol or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading && symbols.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading instruments…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No instruments match your filter.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-800/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Bid / Ask</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                  <TableHead className="text-right">Min / Max Lot</TableHead>
                  <TableHead className="text-right">Contract Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sym) => {
                  const q = quotes[sym.symbol];
                  const inWatchlist = watchlist.includes(sym.symbol);
                  const spread = q ? getSpreadPips(q, sym.pricePrecision) : null;

                  return (
                    <TableRow key={sym.symbol}>
                      <TableCell>
                        <div className="font-semibold text-xs text-slate-100">
                          {sym.alias || sym.symbol}
                        </div>
                        <div className="text-[10px] text-slate-400">{sym.symbol}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {sym.type ?? 'INSTRUMENT'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {q ? (
                          <span>
                            <span className="text-rose-400">
                              {formatPrice(q.bid, sym.pricePrecision)}
                            </span>
                            {' / '}
                            <span className="text-emerald-400">
                              {formatPrice(q.ask, sym.pricePrecision)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-300">
                        {spread !== null ? `${spread.toFixed(1)}p` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-300">
                        {sym.volumeMin} / {sym.volumeMax} (step {sym.volumeStep})
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-300">
                        {sym.contractSize}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleFavoriteSymbol(sym.symbol)}
                            aria-label={`Favorit ${sym.symbol}`}
                            className="h-7 px-2 text-[11px]"
                          >
                            <Star
                              className={`mr-1 h-3 w-3 ${
                                inWatchlist
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            />
                            {inWatchlist ? 'Favorit' : '+ Favorit'}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedSymbol(sym.symbol);
                              onSelectTrade?.(sym.symbol);
                            }}
                            className="h-7 px-2 text-[11px]"
                          >
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Trade
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
