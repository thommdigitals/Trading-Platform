'use client';

import * as React from 'react';
import { Pencil, Trash2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showError, showSuccess } from '@/components/ui/toast';
import { usePendingOrders } from '@/hooks/usePendingOrders';
import { useTradingStore } from '@/store/tradingStore';
import type { PendingOrder } from '@/types/api';
import { formatDateTime } from '@/utils/dateTime';
import { formatPrice } from '@/utils/formatters';
import { ModifyPendingOrderDialog } from './ModifyPendingOrderDialog';

export function PendingOrderTable() {
  const { pendingOrders, updatePendingOrder, cancelPendingOrder, cancelAllPendingOrders } =
    usePendingOrders(false);
  const symbols = useTradingStore((s) => s.symbols);

  const [search, setSearch] = React.useState('');
  const [editingOrder, setEditingOrder] = React.useState<PendingOrder | null>(null);
  const [cancelingOrder, setCancelingOrder] = React.useState<PendingOrder | null>(null);
  const [confirmCancelAll, setConfirmCancelAll] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const symbolMap = React.useMemo(
    () => new Map(symbols.map((s) => [s.symbol, s])),
    [symbols],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toUpperCase();
    return pendingOrders.filter((o) => !q || o.symbol.includes(q) || o.id.includes(q));
  }, [pendingOrders, search]);

  const handleConfirmCancelSingle = async () => {
    if (!cancelingOrder) return;
    setSubmitting(true);
    try {
      await cancelPendingOrder(cancelingOrder.id);
      showSuccess(`Pending order #${cancelingOrder.id} dibatalkan.`);
      setCancelingOrder(null);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancelAll = async () => {
    setSubmitting(true);
    try {
      await cancelAllPendingOrders();
      showSuccess('Semua pending order berhasil dibatalkan.');
      setConfirmCancelAll(false);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Orders ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Cari symbol / ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          {pendingOrders.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmCancelAll(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Cancel All ({pendingOrders.length})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada pending order aktif.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Activation Price</TableHead>
                <TableHead>TP</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>Create Time</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ord) => {
                const prec = symbolMap.get(ord.symbol)?.pricePrecision ?? 5;
                return (
                  <TableRow key={ord.id}>
                    <TableCell className="font-mono text-slate-500">#{ord.id}</TableCell>
                    <TableCell className="font-bold">{ord.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ord.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ord.side === 'BUY' ? 'success' : 'danger'}>
                        {ord.side}
                      </Badge>
                    </TableCell>
                    <TableCell>{ord.volume}</TableCell>
                    <TableCell className="font-mono">
                      {formatPrice(ord.activationPrice, prec)}
                    </TableCell>
                    <TableCell className="font-mono">{formatPrice(ord.tpPrice, prec)}</TableCell>
                    <TableCell className="font-mono">{formatPrice(ord.slPrice, prec)}</TableCell>
                    <TableCell className="text-slate-500">
                      {formatDateTime(ord.createTime)}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-slate-500">
                      {ord.comment || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingOrder(ord)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelingOrder(ord)}
                        >
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          Cancel
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

      <ModifyPendingOrderDialog
        order={editingOrder}
        pricePrecision={
          editingOrder ? (symbolMap.get(editingOrder.symbol)?.pricePrecision ?? 5) : 5
        }
        volumeStep={
          editingOrder ? (symbolMap.get(editingOrder.symbol)?.volumeStep ?? 0.01) : 0.01
        }
        onOpenChange={(open) => {
          if (!open) setEditingOrder(null);
        }}
        onSubmit={updatePendingOrder}
      />

      <Dialog
        open={Boolean(cancelingOrder)}
        onOpenChange={(open) => {
          if (!open) setCancelingOrder(null);
        }}
        title={`Batalkan Pending Order #${cancelingOrder?.id ?? ''}?`}
        description="Pending order yang dibatalkan tidak akan dieksekusi."
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCancelingOrder(null)}
            disabled={submitting}
          >
            Kembali
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleConfirmCancelSingle()}
            disabled={submitting}
          >
            {submitting ? 'Membatalkan...' : 'Ya, Batalkan Order'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmCancelAll}
        onOpenChange={setConfirmCancelAll}
        title="Batalkan Semua Pending Orders?"
        description={`Seluruh ${pendingOrders.length} pending order akan dibatalkan sekaligus.`}
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmCancelAll(false)}
            disabled={submitting}
          >
            Kembali
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleConfirmCancelAll()}
            disabled={submitting}
          >
            {submitting ? 'Membatalkan...' : `Ya, Cancel All (${pendingOrders.length})`}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
