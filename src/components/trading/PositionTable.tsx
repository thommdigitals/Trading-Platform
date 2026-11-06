'use client';

import * as React from 'react';
import { ArrowUpDown, Pencil, XCircle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { showError, showSuccess } from '@/components/ui/toast';
import { usePositions } from '@/hooks/usePositions';
import { useTradingStore } from '@/store/tradingStore';
import type { Position, Side } from '@/types/api';
import { formatDateTime } from '@/utils/dateTime';
import { formatPrice, formatSigned, pnlColorClass } from '@/utils/formatters';
import { netPnl } from '@/utils/tradingCalculations';
import { ModifyPositionDialog } from './ModifyPositionDialog';

type SortKey = 'symbol' | 'profit' | 'openTime';

export function PositionTable() {
  const { positions, closePosition, updatePosition, closeAllPositions } = usePositions(false);
  const symbols = useTradingStore((s) => s.symbols);
  const quotes = useTradingStore((s) => s.quotes);
  const account = useTradingStore((s) => s.account);

  const [search, setSearch] = React.useState('');
  const [sideFilter, setSideFilter] = React.useState<'ALL' | Side>('ALL');
  const [sortKey, setSortKey] = React.useState<SortKey>('openTime');
  const [sortAsc, setSortAsc] = React.useState(false);

  const [modifyingPos, setModifyingPos] = React.useState<Position | null>(null);
  const [closingIds, setClosingIds] = React.useState<Record<string, boolean>>({});
  const [closingAll, setClosingAll] = React.useState(false);

  const symbolMap = React.useMemo(
    () => new Map(symbols.map((s) => [s.symbol, s])),
    [symbols],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toUpperCase();
    return positions
      .filter((p) => {
        if (sideFilter !== 'ALL' && p.side !== sideFilter) return false;
        if (q && !p.symbol.includes(q) && !p.id.includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol) * dir;
        if (sortKey === 'profit') return (netPnl(a) - netPnl(b)) * dir;
        return (a.openTime - b.openTime) * dir;
      });
  }, [positions, search, sideFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleCloseSingle = async (pos: Position) => {
    if (closingIds[pos.id] || closingAll) return;
    setClosingIds((prev) => ({ ...prev, [pos.id]: true }));
    try {
      await closePosition(pos.id, pos.volume);
      showSuccess(`Posisi #${pos.id} (${pos.symbol}) sebesar ${pos.volume} lot berhasil ditutup.`);
    } catch (err) {
      showError(err);
    } finally {
      setClosingIds((prev) => {
        const next = { ...prev };
        delete next[pos.id];
        return next;
      });
    }
  };

  const handleCloseAll = async () => {
    if (closingAll) return;
    setClosingAll(true);
    try {
      await closeAllPositions();
      showSuccess('Semua posisi terbuka berhasil ditutup.');
    } catch (err) {
      showError(err);
    } finally {
      setClosingAll(false);
    }
  };

  const currency = account?.currency ?? 'USD';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Posisi Terbuka ({filtered.length})</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Cari symbol / ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          <Select
            aria-label="Filter arah posisi"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as 'ALL' | Side)}
            className="h-8 w-28 text-xs"
          >
            <option value="ALL">Semua Side</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </Select>
          {positions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={closingAll}
              onClick={() => void handleCloseAll()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {closingAll ? 'Menutup...' : `Close All (${positions.length})`}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada posisi terbuka.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort('symbol')}
                    className="inline-flex items-center gap-1 cursor-pointer"
                  >
                    Symbol <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Open Price</TableHead>
                <TableHead>Current</TableHead>
                <TableHead title="Double-click untuk edit TP">TP</TableHead>
                <TableHead title="Double-click untuk edit SL">SL</TableHead>
                <TableHead>Swap</TableHead>
                <TableHead>Comm</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort('openTime')}
                    className="inline-flex items-center gap-1 cursor-pointer"
                  >
                    Open Time <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort('profit')}
                    className="inline-flex items-center gap-1 cursor-pointer"
                  >
                    Net P&amp;L <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((pos) => {
                const sym = symbolMap.get(pos.symbol);
                const prec = sym?.pricePrecision ?? 5;
                const pnl = netPnl(pos);
                return (
                  <TableRow key={pos.id}>
                    <TableCell className="font-mono text-slate-500">#{pos.id}</TableCell>
                    <TableCell className="font-bold">{pos.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={pos.side === 'BUY' ? 'success' : 'danger'}>
                        {pos.side}
                      </Badge>
                    </TableCell>
                    <TableCell>{pos.volume}</TableCell>
                    <TableCell className="font-mono">{formatPrice(pos.openPrice, prec)}</TableCell>
                    <TableCell className="font-mono">
                      {formatPrice(pos.currentPrice ?? pos.openPrice, prec)}
                    </TableCell>
                    <TableCell
                      onDoubleClick={() => setModifyingPos(pos)}
                      className="font-mono cursor-pointer hover:underline"
                      title="Double-click untuk ubah TP"
                    >
                      {formatPrice(pos.tpPrice, prec)}
                    </TableCell>
                    <TableCell
                      onDoubleClick={() => setModifyingPos(pos)}
                      className="font-mono cursor-pointer hover:underline"
                      title="Double-click untuk ubah SL"
                    >
                      {formatPrice(pos.slPrice, prec)}
                    </TableCell>
                    <TableCell className="font-mono">{pos.swap.toFixed(2)}</TableCell>
                    <TableCell className="font-mono">{pos.commission.toFixed(2)}</TableCell>
                    <TableCell className="text-slate-500">
                      {formatDateTime(pos.openTime)}
                    </TableCell>
                    <TableCell className={`font-mono font-bold ${pnlColorClass(pnl)}`}>
                      {formatSigned(pnl, 2)} {currency}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModifyingPos(pos)}
                          aria-label={`Ubah posisi ${pos.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Boolean(closingIds[pos.id]) || closingAll}
                          onClick={() => void handleCloseSingle(pos)}
                          aria-label={`Tutup posisi ${pos.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          {closingIds[pos.id] ? 'Closing...' : 'Close'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ModifyPositionDialog
        position={modifyingPos}
        quote={modifyingPos ? quotes[modifyingPos.symbol] : undefined}
        pricePrecision={
          modifyingPos ? (symbolMap.get(modifyingPos.symbol)?.pricePrecision ?? 5) : 5
        }
        onOpenChange={(open) => {
          if (!open) setModifyingPos(null);
        }}
        onSubmit={updatePosition}
      />
    </Card>
  );
}

