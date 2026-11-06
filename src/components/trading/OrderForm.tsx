'use client';

import * as React from 'react';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { showError, showSuccess } from '@/components/ui/toast';
import { usePositions } from '@/hooks/usePositions';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { Side } from '@/types/api';
import { formatMoney, formatPrice } from '@/utils/formatters';
import {
  estimateMargin,
  getSpreadPips,
  normalizeVolume,
  validateTpSl,
  validateVolume,
} from '@/utils/tradingCalculations';
import { TradeConfirmDialog } from './TradeConfirmDialog';

export interface OrderFormProps {
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
  initialSide?: Side;
  compact?: boolean;
}

export function OrderForm({
  symbol: controlledSymbol,
  onSymbolChange,
  initialSide = 'BUY',
  compact = false,
}: OrderFormProps) {
  const defaultSymbol = useConfigStore((s) => s.defaultSymbol);
  const setDefaultSymbol = useConfigStore((s) => s.setDefaultSymbol);
  const riskSettings = useConfigStore((s) => s.riskSettings);

  const symbols = useTradingStore((s) => s.symbols);
  const quotes = useTradingStore((s) => s.quotes);
  const account = useTradingStore((s) => s.account);
  const { openPosition } = usePositions(false);

  const activeSymbol = controlledSymbol ?? defaultSymbol;
  const setSymbol = (next: string) => {
    setDefaultSymbol(next);
    onSymbolChange?.(next);
  };

  const [side, setSide] = React.useState<Side>(initialSide);
  const [volume, setVolume] = React.useState<number>(0.01);
  const [tpText, setTpText] = React.useState<string>('');
  const [slText, setSlText] = React.useState<string>('');
  const [comment, setComment] = React.useState<string>('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setSide(initialSide);
  }, [initialSide]);

  const symbolInfo = React.useMemo(
    () =>
      symbols.find((s) => s.symbol === activeSymbol) ?? {
        symbol: activeSymbol || 'EURUSD',
        alias: activeSymbol || 'EUR/USD',
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
      },
    [symbols, activeSymbol],
  );

  const quote = quotes[symbolInfo.symbol];
  const entryPrice = quote ? (side === 'BUY' ? quote.ask : quote.bid) : 0;
  const tpPrice = tpText.trim() === '' ? null : Number(tpText);
  const slPrice = slText.trim() === '' ? null : Number(slText);

  const volumeError = validateVolume(volume, symbolInfo);
  const tpSlErrors = quote
    ? validateTpSl({
        side,
        tpPrice: tpPrice !== null && Number.isFinite(tpPrice) ? tpPrice : null,
        slPrice: slPrice !== null && Number.isFinite(slPrice) ? slPrice : null,
        quote,
      })
    : { tp: null, sl: null };

  const hasValidationError = Boolean(volumeError || tpSlErrors.tp || tpSlErrors.sl);
  const estMargin = estimateMargin(
    volume,
    entryPrice || 1,
    symbolInfo,
    account?.leverage ?? 100,
  );
  const spreadPips = quote ? getSpreadPips(quote, symbolInfo.pricePrecision) : null;
  const sessionClosed = symbolInfo.sessionOpen === false;
  const highLotWarning = volume > riskSettings.maxLotWarning;

  const stepVolume = (delta: number) => {
    setVolume((current) => normalizeVolume(current + delta * symbolInfo.volumeStep, symbolInfo));
  };

  const executeOrder = async () => {
    setSubmitting(true);
    try {
      const result = await openPosition({
        symbol: symbolInfo.symbol,
        side,
        volume,
        tpPrice,
        slPrice,
        comment: comment.trim() || undefined,
      });
      showSuccess(
        `Order ${side} ${symbolInfo.symbol} (${volume} lot) berhasil dibuka (#${result.positionId}).`,
      );
      setTpText('');
      setSlText('');
      setComment('');
      setConfirmOpen(false);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasValidationError) return;
    if (riskSettings.confirmBeforeTrade) {
      setConfirmOpen(true);
    } else {
      void executeOrder();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{compact ? 'Quick Trade' : 'Open Position (Market Execution)'}</CardTitle>
        {quote && (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Bid {formatPrice(quote.bid, symbolInfo.pricePrecision)} / Ask{' '}
            {formatPrice(quote.ask, symbolInfo.pricePrecision)}
          </span>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
              Symbol
            </label>
            <Select
              aria-label="Pilih Symbol"
              value={symbolInfo.symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {(symbols.length > 0 ? symbols : [symbolInfo]).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} {s.alias ? `— ${s.alias}` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={side === 'BUY' ? 'buy' : 'outline'}
              onClick={() => setSide('BUY')}
              className="w-full font-bold"
            >
              BUY {quote ? formatPrice(quote.ask, symbolInfo.pricePrecision) : ''}
            </Button>
            <Button
              type="button"
              variant={side === 'SELL' ? 'sell' : 'outline'}
              onClick={() => setSide('SELL')}
              className="w-full font-bold"
            >
              SELL {quote ? formatPrice(quote.bid, symbolInfo.pricePrecision) : ''}
            </Button>
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
              Volume (Lots) — Min {symbolInfo.volumeMin} / Step {symbolInfo.volumeStep}
            </label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Kurangi volume"
                onClick={() => stepVolume(-1)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                type="number"
                aria-label="Volume (Lots)"
                step={symbolInfo.volumeStep}
                min={symbolInfo.volumeMin}
                max={symbolInfo.volumeMax}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="text-center font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Tambah volume"
                onClick={() => stepVolume(1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {volumeError && <p className="mt-1 text-rose-500">{volumeError}</p>}
            {highLotWarning && !volumeError && (
              <p className="mt-1 flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Volume melebihi batas peringatan ({riskSettings.maxLotWarning} lot)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                Take Profit (Opsional)
              </label>
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
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                Stop Loss (Opsional)
              </label>
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

          {!compact && (
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                Comment (Opsional)
              </label>
              <Input
                placeholder="Catatan order..."
                maxLength={128}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}

          {sessionClosed && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Sesi trading untuk {symbolInfo.symbol} sedang tutup.</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            <span>
              Est. Margin:{' '}
              <strong>{formatMoney(estMargin, account?.currency ?? 'USD', 2)}</strong>
            </span>
            <span>
              Spread: <strong>{spreadPips !== null ? `${spreadPips.toFixed(1)} pips` : '—'}</strong>
            </span>
          </div>

          <Button
            type="submit"
            variant={side === 'BUY' ? 'buy' : 'sell'}
            className="w-full font-bold"
            disabled={hasValidationError || submitting || sessionClosed}
          >
            {submitting
              ? 'Mengirim Order...'
              : `Open ${side} ${symbolInfo.symbol} (${volume} lot)`}
          </Button>
        </form>
      </CardContent>

      <TradeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        symbol={symbolInfo.symbol}
        side={side}
        volume={volume}
        tpPrice={tpPrice}
        slPrice={slPrice}
        estimatedMargin={formatMoney(estMargin, account?.currency ?? 'USD', 2)}
        submitting={submitting}
        onConfirm={() => void executeOrder()}
      />
    </Card>
  );
}
