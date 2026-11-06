'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClosedPosition } from '@/types/api';
import type { CsvColumn } from '@/utils/csvExport';
import { formatDateTime } from '@/utils/dateTime';
import { formatPrice, formatSigned } from '@/utils/formatters';
import { netPnl } from '@/utils/tradingCalculations';

import { ExportButton } from './ExportButton';

export interface ClosedPositionsTableProps {
  readonly positions: readonly ClosedPosition[];
  readonly currency?: string;
}

const CSV_COLUMNS: readonly CsvColumn<ClosedPosition>[] = [
  { header: 'ID', value: (r) => r.id },
  { header: 'Symbol', value: (r) => r.symbol },
  { header: 'Side', value: (r) => r.side },
  { header: 'Volume', value: (r) => r.volume },
  { header: 'Open Price', value: (r) => r.openPrice },
  { header: 'Close Price', value: (r) => r.closePrice },
  { header: 'Open Time', value: (r) => new Date(r.openTime).toISOString() },
  { header: 'Close Time', value: (r) => new Date(r.closeTime).toISOString() },
  { header: 'Profit', value: (r) => r.profit },
  { header: 'Swap', value: (r) => r.swap },
  { header: 'Commission', value: (r) => r.commission },
  { header: 'Net P&L', value: (r) => netPnl(r) },
  { header: 'Comment', value: (r) => r.comment },
];

export function ClosedPositionsTable({
  positions,
  currency = 'USD',
}: ClosedPositionsTableProps): React.ReactElement {
  const [symbolFilter, setSymbolFilter] = React.useState('');
  const [sideFilter, setSideFilter] = React.useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  const filtered = React.useMemo(() => {
    const q = symbolFilter.trim().toLowerCase();
    return [...positions]
      .filter((p) => {
        if (sideFilter !== 'ALL' && p.side !== sideFilter) return false;
        if (!q) return true;
        return (
          p.symbol.toLowerCase().includes(q) ||
          p.alias.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.comment.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.closeTime - a.closeTime);
  }, [positions, symbolFilter, sideFilter]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-3">
        <CardTitle className="text-sm font-semibold">
          Closed Positions ({filtered.length})
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Filter closed positions by symbol"
            placeholder="Filter symbol or ID…"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="h-8 w-44 text-xs"
          />
          <Select
            aria-label="Filter closed positions by side"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as 'ALL' | 'BUY' | 'SELL')}
            className="h-8 w-32 text-xs py-0.5 px-2"
          >
            <option value="ALL">All Sides</option>
            <option value="BUY">BUY Only</option>
            <option value="SELL">SELL Only</option>
          </Select>
          <ExportButton
            rows={filtered}
            columns={CSV_COLUMNS}
            filenamePrefix="fortuno_closed_positions"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No closed positions found for the selected range and filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Vol</TableHead>
                  <TableHead className="text-right">Open Price</TableHead>
                  <TableHead className="text-right">Close Price</TableHead>
                  <TableHead>Open Time</TableHead>
                  <TableHead>Close Time</TableHead>
                  <TableHead className="text-right">Swap / Comm</TableHead>
                  <TableHead className="text-right">Net P&amp;L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pos) => {
                  const net = netPnl(pos);
                  return (
                    <TableRow key={pos.id}>
                      <TableCell className="font-mono text-xs text-slate-400">#{pos.id}</TableCell>
                      <TableCell className="font-semibold text-xs text-slate-100">
                        {pos.alias || pos.symbol}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pos.side === 'BUY' ? 'success' : 'danger'}>
                          {pos.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{pos.volume}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatPrice(pos.openPrice, 5)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatPrice(pos.closePrice, 5)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {formatDateTime(pos.openTime)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {formatDateTime(pos.closeTime)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-400">
                        {pos.swap.toFixed(2)} / {pos.commission.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs font-bold ${
                          net > 0
                            ? 'text-emerald-400'
                            : net < 0
                              ? 'text-rose-400'
                              : 'text-slate-300'
                        }`}
                      >
                        {formatSigned(net, 2)} {currency}
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
