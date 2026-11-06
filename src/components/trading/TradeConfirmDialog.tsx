'use client';

import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Side } from '@/types/api';

export interface TradeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  side: Side;
  volume: number;
  tpPrice?: number | null;
  slPrice?: number | null;
  estimatedMargin: string;
  submitting: boolean;
  onConfirm: () => void;
}

export function TradeConfirmDialog({
  open,
  onOpenChange,
  symbol,
  side,
  volume,
  tpPrice,
  slPrice,
  estimatedMargin,
  submitting,
  onConfirm,
}: TradeConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Konfirmasi Eksekusi Order"
      description="Pastikan parameter order Anda sudah sesuai sebelum dikirim ke broker."
    >
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <span className="text-slate-500">Instrumen</span>
            <div className="font-bold text-slate-900 dark:text-slate-100">{symbol}</div>
          </div>
          <div>
            <span className="text-slate-500">Arah Order</span>
            <div>
              <Badge variant={side === 'BUY' ? 'success' : 'danger'}>{side}</Badge>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Volume</span>
            <div className="font-semibold">{volume} lot</div>
          </div>
          <div>
            <span className="text-slate-500">Estimasi Margin</span>
            <div className="font-semibold">{estimatedMargin}</div>
          </div>
          <div>
            <span className="text-slate-500">Take Profit</span>
            <div className="font-semibold">{tpPrice ?? '—'}</div>
          </div>
          <div>
            <span className="text-slate-500">Stop Loss</span>
            <div className="font-semibold">{slPrice ?? '—'}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant={side === 'BUY' ? 'buy' : 'sell'}
            size="sm"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Memproses...' : `Konfirmasi ${side}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

