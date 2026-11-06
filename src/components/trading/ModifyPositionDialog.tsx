'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/components/ui/toast';
import type { Position, Quote, UpdatePositionRequest } from '@/types/api';
import { validateTpSl } from '@/utils/tradingCalculations';

export interface ModifyPositionDialogProps {
  position: Position | null;
  quote?: Quote;
  pricePrecision?: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, update: UpdatePositionRequest) => Promise<void>;
}

export function ModifyPositionDialog({
  position,
  quote,
  pricePrecision = 5,
  onOpenChange,
  onSubmit,
}: ModifyPositionDialogProps) {
  const [tpText, setTpText] = React.useState('');
  const [slText, setSlText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (position) {
      setTpText(position.tpPrice !== null ? String(position.tpPrice) : '');
      setSlText(position.slPrice !== null ? String(position.slPrice) : '');
    }
  }, [position]);

  if (!position) return null;

  const tpValue = tpText.trim() === '' ? null : Number(tpText);
  const slValue = slText.trim() === '' ? null : Number(slText);
  const refQuote = quote ?? {
    bid: position.currentPrice ?? position.openPrice,
    ask: position.currentPrice ?? position.openPrice,
  };

  const validation = validateTpSl({
    side: position.side,
    tpPrice: tpValue && Number.isFinite(tpValue) ? tpValue : null,
    slPrice: slValue && Number.isFinite(slValue) ? slValue : null,
    quote: refQuote,
  });

  const hasError = Boolean(validation.tp || validation.sl);
  const step = 10 ** -pricePrecision;

  const handleSave = async () => {
    if (hasError) return;
    setSubmitting(true);
    try {
      await onSubmit(position.id, {
        tpPrice: tpValue,
        slPrice: slValue,
      });
      showSuccess(`TP/SL posisi #${position.id} berhasil diperbarui.`);
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
      title={`Ubah TP / SL Posisi #${position.id} (${position.symbol})`}
      description={`Arah: ${position.side} | Harga Saat Ini: Bid ${refQuote.bid} / Ask ${refQuote.ask}`}
    >
      <div className="space-y-4 text-xs">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-medium text-slate-700 dark:text-slate-300">
              Take Profit (TP)
            </label>
            <button
              type="button"
              onClick={() => setTpText('')}
              className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              Clear TP
            </button>
          </div>
          <Input
            type="number"
            step={step}
            placeholder="Kosongkan untuk menghapus TP"
            value={tpText}
            onChange={(e) => setTpText(e.target.value)}
          />
          {validation.tp && <p className="mt-1 text-rose-500">{validation.tp}</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-medium text-slate-700 dark:text-slate-300">
              Stop Loss (SL)
            </label>
            <button
              type="button"
              onClick={() => setSlText('')}
              className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              Clear SL
            </button>
          </div>
          <Input
            type="number"
            step={step}
            placeholder="Kosongkan untuk menghapus SL"
            value={slText}
            onChange={(e) => setSlText(e.target.value)}
          />
          {validation.sl && <p className="mt-1 text-rose-500">{validation.sl}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={hasError || submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

