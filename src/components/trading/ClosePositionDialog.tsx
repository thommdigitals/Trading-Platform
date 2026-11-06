'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/components/ui/toast';
import type { Position, SymbolInfo } from '@/types/api';
import { formatSigned, pnlColorClass } from '@/utils/formatters';
import { netPnl } from '@/utils/tradingCalculations';

export interface ClosePositionDialogProps {
  position: Position | null;
  symbolInfo?: SymbolInfo;
  currency?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, volume: number) => Promise<void>;
}

export function ClosePositionDialog({
  position,
  symbolInfo,
  currency = 'USD',
  onOpenChange,
  onSubmit,
}: ClosePositionDialogProps) {
  const [mode, setMode] = React.useState<'full' | 'partial'>('full');
  const [partialVolume, setPartialVolume] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (position) {
      setMode('full');
      setPartialVolume(String(position.volume));
    }
  }, [position]);

  if (!position) return null;

  const step = symbolInfo?.volumeStep ?? 0.01;
  const minVol = symbolInfo?.volumeMin ?? 0.01;
  const parsedVol = mode === 'full' ? position.volume : Number(partialVolume);
  const isValidVolume =
    Number.isFinite(parsedVol) && parsedVol >= minVol && parsedVol <= position.volume;
  const ratio = position.volume > 0 ? Math.min(1, parsedVol / position.volume) : 1;
  const estimatedPnl = netPnl(position) * ratio;

  const handleConfirm = async () => {
    if (!isValidVolume) return;
    setSubmitting(true);
    try {
      await onSubmit(position.id, parsedVol);
      showSuccess(`Posisi #${position.id} (${position.symbol}) ditutup sebesar ${parsedVol} lot.`);
      onOpenChange(false);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(position)}
      onOpenChange={onOpenChange}
      title={`Tutup Posisi #${position.id} (${position.symbol})`}
      description="Pilih penutupan penuh (Full Close) atau sebagian volume (Partial Close)."
    >
      <div className="space-y-4 text-xs">
        <div className="flex gap-2">
          <Button
            variant={mode === 'full' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setMode('full');
              setPartialVolume(String(position.volume));
            }}
          >
            Full Close ({position.volume} lot)
          </Button>
          <Button
            variant={mode === 'partial' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setMode('partial')}
          >
            Partial Close
          </Button>
        </div>

        {mode === 'partial' && (
          <div>
            <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Volume yang Ditutup (Min {minVol} — Maks {position.volume})
            </label>
            <Input
              type="number"
              step={step}
              min={minVol}
              max={position.volume}
              value={partialVolume}
              onChange={(e) => setPartialVolume(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <span className="text-slate-500">Posisi</span>
            <div className="mt-0.5 flex items-center gap-1.5 font-semibold">
              <Badge variant={position.side === 'BUY' ? 'success' : 'danger'}>
                {position.side}
              </Badge>
              <span>{position.symbol}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Harga Saat Ini</span>
            <div className="mt-0.5 font-semibold">{position.currentPrice ?? position.openPrice}</div>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Estimasi Realisasi P&amp;L</span>
            <div className={`mt-0.5 text-sm font-bold ${pnlColorClass(estimatedPnl)}`}>
              {formatSigned(estimatedPnl, 2)} {currency}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={!isValidVolume || submitting}
          >
            {submitting ? 'Menutup...' : 'Konfirmasi Close'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
