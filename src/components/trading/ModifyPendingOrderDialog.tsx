'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/components/ui/toast';
import type { PendingOrder, UpdatePendingOrderRequest } from '@/types/api';

export interface ModifyPendingOrderDialogProps {
  order: PendingOrder | null;
  pricePrecision?: number;
  volumeStep?: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, update: UpdatePendingOrderRequest) => Promise<void>;
}

export function ModifyPendingOrderDialog({
  order,
  pricePrecision = 5,
  volumeStep = 0.01,
  onOpenChange,
  onSubmit,
}: ModifyPendingOrderDialogProps) {
  const [activationText, setActivationText] = React.useState('');
  const [volumeText, setVolumeText] = React.useState('');
  const [tpText, setTpText] = React.useState('');
  const [slText, setSlText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (order) {
      setActivationText(String(order.activationPrice));
      setVolumeText(String(order.volume));
      setTpText(order.tpPrice !== null ? String(order.tpPrice) : '');
      setSlText(order.slPrice !== null ? String(order.slPrice) : '');
    }
  }, [order]);

  if (!order) return null;

  const stepPrice = 10 ** -pricePrecision;

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSubmit(order.id, {
        activationPrice: Number(activationText),
        volume: Number(volumeText),
        tpPrice: tpText.trim() === '' ? null : Number(tpText),
        slPrice: slText.trim() === '' ? null : Number(slText),
      });
      showSuccess(`Pending order #${order.id} berhasil diperbarui.`);
      onOpenChange(false);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={onOpenChange}
      title={`Ubah Pending Order #${order.id} (${order.symbol})`}
      description={`${order.side} ${order.type}`}
    >
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block font-medium">Activation Price</label>
            <Input
              type="number"
              step={stepPrice}
              value={activationText}
              onChange={(e) => setActivationText(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Volume (Lots)</label>
            <Input
              type="number"
              step={volumeStep}
              value={volumeText}
              onChange={(e) => setVolumeText(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 flex justify-between">
              <label className="font-medium">Take Profit</label>
              <button
                type="button"
                onClick={() => setTpText('')}
                className="text-[11px] text-blue-600 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
            <Input
              type="number"
              step={stepPrice}
              placeholder="Opsional"
              value={tpText}
              onChange={(e) => setTpText(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between">
              <label className="font-medium">Stop Loss</label>
              <button
                type="button"
                onClick={() => setSlText('')}
                className="text-[11px] text-blue-600 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
            <Input
              type="number"
              step={stepPrice}
              placeholder="Opsional"
              value={slText}
              onChange={(e) => setSlText(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
