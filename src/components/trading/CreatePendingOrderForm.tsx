'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/components/ui/toast';
import { usePendingOrders } from '@/hooks/usePendingOrders';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { PendingOrderType, Side } from '@/types/api';
import {
  describeActivationRule,
  validateActivationPrice,
  validateTpSl,
  validateVolume,
} from '@/utils/tradingCalculations';

export function CreatePendingOrderForm({ onCreated }: { onCreated?: () => void }) {
  const defaultSymbol = useConfigStore((s) => s.defaultSymbol);
  const symbols = useTradingStore((s) => s.symbols);
  const quotes = useTradingStore((s) => s.quotes);
  const { createPendingOrder } = usePendingOrders(false);

  const [symbol, setSymbol] = React.useState(defaultSymbol);
  const [type, setType] = React.useState<PendingOrderType>('LIMIT');
  const [side, setSide] = React.useState<Side>('BUY');
  const [volume, setVolume] = React.useState<number>(0.01);
  const [activationText, setActivationText] = React.useState<string>('');
  const [tpText, setTpText] = React.useState<string>('');
  const [slText, setSlText] = React.useState<string>('');
  const [comment, setComment] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  const symbolInfo =
    symbols.find((s) => s.symbol === symbol) ?? {
      symbol: symbol || 'EURUSD',
      alias: symbol || 'EUR/USD',
      pricePrecision: 5,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
      contractSize: 100_000,
      swapLong: null,
      swapShort: null,
      marginRequired: null,
      sessionOpen: true,
      type: 'FOREX',
    };

  const quote = quotes[symbolInfo.symbol];
  const activationPrice = Number(activationText);
  const tpPrice = tpText.trim() === '' ? null : Number(tpText);
  const slPrice = slText.trim() === '' ? null : Number(slText);

  const volumeError = validateVolume(volume, symbolInfo);
  const activationError =
    quote && Number.isFinite(activationPrice) && activationPrice > 0
      ? validateActivationPrice({ type, side, activationPrice, quote })
      : !activationText
        ? 'Activation price wajib diisi'
        : null;

  const tpSlErrors =
    Number.isFinite(activationPrice) && activationPrice > 0
      ? validateTpSl({
          side,
          tpPrice,
          slPrice,
          quote: { bid: activationPrice, ask: activationPrice },
        })
      : { tp: null, sl: null };

  const liveHint = quote
    ? describeActivationRule(type, side, quote)
    : 'Pilih simbol untuk melihat aturan harga aktivasi.';

  const hasError = Boolean(
    volumeError || activationError || tpSlErrors.tp || tpSlErrors.sl,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasError || submitting) return;
    setSubmitting(true);
    try {
      const res = await createPendingOrder({
        symbol: symbolInfo.symbol,
        side,
        type,
        volume,
        activationPrice,
        tpPrice,
        slPrice,
        comment: comment.trim() || undefined,
      });
      showSuccess(
        `Pending order ${side} ${type} ${symbolInfo.symbol} dibuat (#${res.orderId}).`,
      );
      setActivationText('');
      setTpText('');
      setSlText('');
      setComment('');
      onCreated?.();
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle>Buat Pending Order (LIMIT / STOP)</CardTitle>
          <Tooltip content="LIMIT: eksekusi pada harga lebih baik dari pasar saat ini. STOP: eksekusi saat harga menembus level breakout.">
            <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium">Symbol</label>
              <Select value={symbolInfo.symbol} onChange={(e) => setSymbol(e.target.value)}>
                {(symbols.length > 0 ? symbols : [symbolInfo]).map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Order Type</label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as PendingOrderType)}
              >
                <option value="LIMIT">LIMIT</option>
                <option value="STOP">STOP</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Side</label>
              <Select value={side} onChange={(e) => setSide(e.target.value as Side)}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">Activation Price</label>
              <Input
                type="number"
                step={10 ** -symbolInfo.pricePrecision}
                placeholder="Contoh: 1.08000"
                value={activationText}
                onChange={(e) => setActivationText(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{liveHint}</p>
              {activationError && activationText && (
                <p className="mt-0.5 text-rose-500">{activationError}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block font-medium">Volume (Lots)</label>
              <Input
                type="number"
                step={symbolInfo.volumeStep}
                min={symbolInfo.volumeMin}
                max={symbolInfo.volumeMax}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
              {volumeError && <p className="mt-1 text-rose-500">{volumeError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-medium">Take Profit (Opsional)</label>
              <Input
                type="number"
                step={10 ** -symbolInfo.pricePrecision}
                placeholder="Opsional"
                value={tpText}
                onChange={(e) => setTpText(e.target.value)}
              />
              {tpSlErrors.tp && <p className="mt-1 text-rose-500">{tpSlErrors.tp}</p>}
            </div>
            <div>
              <label className="mb-1 block font-medium">Stop Loss (Opsional)</label>
              <Input
                type="number"
                step={10 ** -symbolInfo.pricePrecision}
                placeholder="Opsional"
                value={slText}
                onChange={(e) => setSlText(e.target.value)}
              />
              {tpSlErrors.sl && <p className="mt-1 text-rose-500">{tpSlErrors.sl}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium">Comment (Opsional)</label>
            <Input
              placeholder="Catatan..."
              maxLength={128}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            variant={side === 'BUY' ? 'buy' : 'sell'}
            disabled={hasError || submitting}
            className="w-full font-bold"
          >
            {submitting ? 'Membuat Order...' : `Buat ${side} ${type} ${symbolInfo.symbol}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

