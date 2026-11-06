'use client';

import * as React from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  Activity,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCandles } from '@/hooks/useCandles';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { Candle, CandleInterval } from '@/types/api';
import { formatPrice } from '@/utils/formatters';
import {
  BUILTIN_INDICATORS,
  calculateATR,
  calculateBollingerBands,
  calculateDonchianChannel,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateVWAP,
  calculateWMA,
  type IndicatorKind,
  type IndicatorSpec,
  lastValue,
  resolveIndicatorSpec,
  type Series,
} from '@/utils/indicators';

import { IntervalSelector } from './IntervalSelector';

export interface CandleChartProps {
  readonly height?: number;
  readonly compact?: boolean;
}

function toLineData(
  series: Series,
  candles: readonly Candle[],
): Array<{ time: UTCTimestamp; value: number }> {
  const out: Array<{ time: UTCTimestamp; value: number }> = [];
  for (let i = 0; i < series.length; i += 1) {
    const val = series[i];
    const bar = candles[i];
    if (val !== null && val !== undefined && bar) {
      out.push({
        time: Math.floor(bar.timestamp / 1000) as UTCTimestamp,
        value: val,
      });
    }
  }
  return out;
}

export function CandleChart({
  height = 420,
  compact = false,
}: CandleChartProps): React.ReactElement {
  const selectedSymbol = useConfigStore((s) => s.defaultSymbol);
  const setSelectedSymbol = useConfigStore((s) => s.setDefaultSymbol);
  const selectedInterval = useConfigStore((s) => s.defaultInterval);
  const setSelectedInterval = useConfigStore((s) => s.setDefaultInterval);
  const watchlist = useConfigStore((s) => s.watchlist);
  const toggleFavoriteSymbol = useConfigStore((s) => s.toggleFavoriteSymbol);
  const favoriteIndicators = useConfigStore((s) => s.favoriteIndicators);
  const activeIndicators = useConfigStore((s) => s.activeIndicators);
  const toggleFavoriteIndicator = useConfigStore((s) => s.toggleFavoriteIndicator);
  const toggleActiveIndicator = useConfigStore((s) => s.toggleActiveIndicator);
  const addCustomIndicator = useConfigStore((s) => s.addCustomIndicator);

  const positions = useTradingStore((s) => s.positions);
  const quotes = useTradingStore((s) => s.quotes);
  const theme = useConfigStore((s) => s.theme);

  const { symbols } = useSymbols();
  const { candles, loading, refresh } = useCandles(selectedSymbol, selectedInterval);

  const symbolInfo = React.useMemo(
    () => symbols.find((s) => s.symbol === selectedSymbol),
    [symbols, selectedSymbol],
  );
  const precision = symbolInfo?.pricePrecision ?? 5;
  const quote = quotes[selectedSymbol];
  const isSymbolFavorite = watchlist.includes(selectedSymbol);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [hoveredCandle, setHoveredCandle] = React.useState<Candle | null>(null);
  const [indicatorModalOpen, setIndicatorModalOpen] = React.useState(false);
  const [customKind, setCustomKind] = React.useState<IndicatorKind>('EMA');
  const [customPeriod, setCustomPeriod] = React.useState<string>('34');

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const candleSeriesRef = React.useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = React.useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlaySeriesRef = React.useRef<Map<string, ISeriesApi<'Line'>[]>>(new Map());
  const priceLinesRef = React.useRef<IPriceLine[]>([]);

  const sortedCandles = React.useMemo(() => {
    const map = new Map<number, Candle>();
    for (const c of candles) {
      const sec = Math.floor(c.timestamp / 1000);
      map.set(sec, c);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, c]) => c);
  }, [candles]);

  // Combine favorite indicators + any active custom indicators for the toolbar
  const toolbarSpecs = React.useMemo(() => {
    const ids = Array.from(new Set([...favoriteIndicators, ...activeIndicators]));
    return ids
      .map((id) => resolveIndicatorSpec(id))
      .filter((spec): spec is IndicatorSpec => spec !== null);
  }, [favoriteIndicators, activeIndicators]);

  // All catalog indicators (built-ins + any user-created custom indicator)
  const catalogSpecs = React.useMemo(() => {
    const map = new Map<string, IndicatorSpec>();
    for (const b of BUILTIN_INDICATORS) map.set(b.id, b);
    for (const id of [...favoriteIndicators, ...activeIndicators]) {
      const spec = resolveIndicatorSpec(id);
      if (spec && !map.has(spec.id)) map.set(spec.id, spec);
    }
    return Array.from(map.values());
  }, [favoriteIndicators, activeIndicators]);

  // Compute live oscillator/metric values for active metric indicators
  const activeMetrics = React.useMemo(() => {
    if (sortedCandles.length === 0) return [];
    const out: Array<{ id: string; label: string; valueText: string; variant: 'danger' | 'success' | 'outline' }> = [];

    for (const id of activeIndicators) {
      const spec = resolveIndicatorSpec(id);
      if (!spec || spec.placement !== 'metric') continue;

      if (spec.kind === 'RSI') {
        const val = lastValue(calculateRSI(sortedCandles, spec.period));
        if (val !== null) {
          out.push({
            id: spec.id,
            label: spec.label,
            valueText: val.toFixed(1),
            variant: val >= 70 ? 'danger' : val <= 30 ? 'success' : 'outline',
          });
        }
      } else if (spec.kind === 'MACD') {
        const macdRes = calculateMACD(sortedCandles, spec.period, 26, 9);
        const m = lastValue(macdRes.macd);
        const h = lastValue(macdRes.histogram);
        if (m !== null) {
          out.push({
            id: spec.id,
            label: spec.label,
            valueText: `${m.toFixed(precision)} (H: ${(h ?? 0) >= 0 ? '+' : ''}${(h ?? 0).toFixed(precision)})`,
            variant: (h ?? 0) > 0 ? 'success' : (h ?? 0) < 0 ? 'danger' : 'outline',
          });
        }
      } else if (spec.kind === 'ATR') {
        const val = lastValue(calculateATR(sortedCandles, spec.period));
        if (val !== null) {
          out.push({
            id: spec.id,
            label: spec.label,
            valueText: formatPrice(val, precision),
            variant: 'outline',
          });
        }
      } else if (spec.kind === 'STOCH') {
        const st = calculateStochastic(sortedCandles, spec.period, 3);
        const k = lastValue(st.k);
        const d = lastValue(st.d);
        if (k !== null) {
          out.push({
            id: spec.id,
            label: spec.label,
            valueText: `%K ${k.toFixed(1)} / %D ${(d ?? k).toFixed(1)}`,
            variant: k >= 80 ? 'danger' : k <= 20 ? 'success' : 'outline',
          });
        }
      }
    }
    return out;
  }, [sortedCandles, activeIndicators, precision]);

  // Initialize chart instance
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isLight = theme === 'light';
    const chart = createChart(container, {
      width: container.clientWidth || 640,
      height: isFullscreen ? Math.max(window.innerHeight - 180, 480) : height,
      layout: {
        background: {
          type: ColorType.Solid,
          color: isLight ? '#ffffff' : '#090d16',
        },
        textColor: isLight ? '#334155' : '#94a3b8',
      },
      grid: {
        vertLines: { color: isLight ? '#f1f5f9' : '#1e293b66' },
        horzLines: { color: isLight ? '#f1f5f9' : '#1e293b66' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: isLight ? '#e2e8f0' : '#1e293b',
      },
      timeScale: {
        borderColor: isLight ? '#e2e8f0' : '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision,
        minMove: Number((10 ** -precision).toFixed(precision)),
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const overlayMap = overlaySeriesRef.current;
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    overlayMap.clear();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({
          width: entry.contentRect.width,
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      overlayMap.clear();
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, [theme, height, isFullscreen, precision]);

  // Populate candle & dynamic overlay indicator series data
  React.useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (!chart || !candleSeries || !volumeSeries || sortedCandles.length === 0) return;

    const candleData = sortedCandles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = sortedCandles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as UTCTimestamp,
      value: c.tickCount,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)',
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    const activeOverlaySpecs = activeIndicators
      .map((id) => resolveIndicatorSpec(id))
      .filter((s): s is IndicatorSpec => s !== null && s.placement === 'overlay');
    const activeOverlayIds = new Set(activeOverlaySpecs.map((s) => s.id));

    // Remove disabled overlay series
    for (const [id, seriesList] of overlaySeriesRef.current.entries()) {
      if (!activeOverlayIds.has(id)) {
        for (const s of seriesList) {
          try {
            chart.removeSeries(s);
          } catch {
            // ignore
          }
        }
        overlaySeriesRef.current.delete(id);
      }
    }

    // Add or update active overlay series
    for (const spec of activeOverlaySpecs) {
      let seriesList = overlaySeriesRef.current.get(spec.id);
      const neededLines = spec.kind === 'BB' || spec.kind === 'DC' ? 2 : 1;

      if (!seriesList || seriesList.length !== neededLines) {
        if (seriesList) {
          for (const s of seriesList) {
            try {
              chart.removeSeries(s);
            } catch {
              // ignore
            }
          }
        }
        seriesList = [];
        for (let i = 0; i < neededLines; i += 1) {
          const line = chart.addSeries(LineSeries, {
            color: spec.color,
            lineWidth: neededLines === 2 ? 1 : 2,
            lineStyle: neededLines === 2 ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          seriesList.push(line);
        }
        overlaySeriesRef.current.set(spec.id, seriesList);
      }

      if (spec.kind === 'SMA') {
        seriesList[0]?.setData(toLineData(calculateSMA(sortedCandles, spec.period), sortedCandles));
      } else if (spec.kind === 'EMA') {
        seriesList[0]?.setData(toLineData(calculateEMA(sortedCandles, spec.period), sortedCandles));
      } else if (spec.kind === 'WMA') {
        seriesList[0]?.setData(toLineData(calculateWMA(sortedCandles, spec.period), sortedCandles));
      } else if (spec.kind === 'VWAP') {
        seriesList[0]?.setData(toLineData(calculateVWAP(sortedCandles, spec.period), sortedCandles));
      } else if (spec.kind === 'BB') {
        const bb = calculateBollingerBands(sortedCandles, spec.period, 2);
        seriesList[0]?.setData(toLineData(bb.upper, sortedCandles));
        seriesList[1]?.setData(toLineData(bb.lower, sortedCandles));
      } else if (spec.kind === 'DC') {
        const dc = calculateDonchianChannel(sortedCandles, spec.period);
        seriesList[0]?.setData(toLineData(dc.upper, sortedCandles));
        seriesList[1]?.setData(toLineData(dc.lower, sortedCandles));
      }
    }

    setHoveredCandle(sortedCandles[sortedCandles.length - 1] ?? null);
  }, [sortedCandles, activeIndicators]);

  // Draw active position lines (Entry, TP, SL)
  React.useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    for (const line of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(line);
      } catch {
        // Ignore stale price line removal
      }
    }
    priceLinesRef.current = [];

    const symbolPositions = positions.filter((p) => p.symbol === selectedSymbol);
    for (const pos of symbolPositions) {
      const openLine = candleSeries.createPriceLine({
        price: pos.openPrice,
        color: pos.side === 'BUY' ? '#10b981' : '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${pos.side} ${pos.volume}`,
      });
      priceLinesRef.current.push(openLine);

      if (pos.tpPrice && pos.tpPrice > 0) {
        const tpLine = candleSeries.createPriceLine({
          price: pos.tpPrice,
          color: '#22c55e',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TP',
        });
        priceLinesRef.current.push(tpLine);
      }

      if (pos.slPrice && pos.slPrice > 0) {
        const slLine = candleSeries.createPriceLine({
          price: pos.slPrice,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'SL',
        });
        priceLinesRef.current.push(slLine);
      }
    }
  }, [positions, selectedSymbol]);

  const handleAddCustomIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number.parseInt(customPeriod, 10);
    const validPeriod = Number.isFinite(p) ? Math.min(500, Math.max(2, p)) : 14;
    addCustomIndicator(`${customKind}:${validPeriod}`, true);
  };

  const activeBar = hoveredCandle ?? sortedCandles[sortedCandles.length - 1] ?? null;

  return (
    <Card
      className={
        isFullscreen
          ? 'fixed inset-3 z-50 flex flex-col bg-slate-950 border-slate-800 shadow-2xl'
          : 'flex flex-col'
      }
    >
      <CardHeader className="flex flex-col gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Select
              aria-label="Chart symbol"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="h-8 w-36 font-semibold text-xs py-0.5 px-2"
            >
              {symbols.length > 0 ? (
                symbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.alias || s.symbol}
                  </option>
                ))
              ) : (
                <option value={selectedSymbol}>{selectedSymbol}</option>
              )}
            </Select>

            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => toggleFavoriteSymbol(selectedSymbol)}
              aria-label={
                isSymbolFavorite
                  ? `Hapus ${selectedSymbol} dari Favorit Symbol`
                  : `Tambah ${selectedSymbol} ke Favorit Symbol`
              }
              title={
                isSymbolFavorite
                  ? 'Hapus dari Favorit Symbol (Watchlist)'
                  : 'Tambah ke Favorit Symbol (Watchlist)'
              }
              className="h-8 w-8"
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  isSymbolFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                }`}
              />
            </Button>

            <IntervalSelector
              value={selectedInterval}
              onChange={(interval: CandleInterval) => setSelectedInterval(interval)}
            />

            {quote && (
              <div className="hidden md:flex items-center gap-2 rounded-md bg-slate-900/90 px-2.5 py-1 border border-slate-800 text-xs font-mono">
                <span className="text-rose-400">B: {formatPrice(quote.bid, precision)}</span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-400">A: {formatPrice(quote.ask, precision)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIndicatorModalOpen(true)}
              className="h-7 px-2.5 text-[11px]"
            >
              <SlidersHorizontal className="mr-1 h-3 w-3 text-blue-400" />
              + Indikator ({activeIndicators.length})
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => void refresh(true)}
              aria-label="Refresh candles"
              className="h-7 w-7"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsFullscreen((f) => !f)}
              aria-label={isFullscreen ? 'Exit fullscreen chart' : 'Fullscreen chart'}
              className="h-7 w-7"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Baris Cepat: Favorit Symbol */}
        {watchlist.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" /> Favorit Symbol:
            </span>
            {watchlist.map((sym) => {
              const active = sym === selectedSymbol;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setSelectedSymbol(sym)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-mono font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        )}

        {/* Baris Cepat: Favorit Indikator & Indikator Aktif */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            <Activity className="h-3 w-3" /> Favorit Indikator:
          </span>
          {toolbarSpecs.map((spec) => {
            const isActive = activeIndicators.includes(spec.id);
            const isFav = favoriteIndicators.includes(spec.id);
            return (
              <div
                key={spec.id}
                className={`inline-flex items-center rounded-md border text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'border-blue-500/50 bg-blue-500/20 text-blue-200'
                    : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleActiveIndicator(spec.id)}
                  className="px-2 py-0.5"
                  title={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${spec.label}`}
                >
                  <span
                    className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: spec.color }}
                  />
                  {spec.label}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavoriteIndicator(spec.id)}
                  aria-label={`Favorit ${spec.label}`}
                  title={isFav ? 'Hapus dari Favorit Indikator' : 'Simpan ke Favorit Indikator'}
                  className="border-l border-slate-800/80 px-1 py-0.5 hover:text-amber-400"
                >
                  <Star
                    className={`h-2.5 w-2.5 ${
                      isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                    }`}
                  />
                </button>
              </div>
            );
          })}

          {activeMetrics.map((m) => (
            <Badge key={m.id} variant={m.variant} className="font-mono text-[10px]">
              <Activity className="mr-1 h-3 w-3" />
              {m.label}: {m.valueText}
            </Badge>
          ))}
        </div>

        {activeBar && !compact && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                O:{' '}
                <strong className="text-slate-200">{formatPrice(activeBar.open, precision)}</strong>
              </span>
              <span>
                H:{' '}
                <strong className="text-emerald-400">{formatPrice(activeBar.high, precision)}</strong>
              </span>
              <span>
                L:{' '}
                <strong className="text-rose-400">{formatPrice(activeBar.low, precision)}</strong>
              </span>
              <span>
                C:{' '}
                <strong className="text-slate-100">{formatPrice(activeBar.close, precision)}</strong>
              </span>
              <span>
                Ticks: <strong className="text-slate-300">{activeBar.tickCount}</strong>
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Data Live: Fortuno Markets (Match-Trader Feed) • Visual: TradingView Lightweight Charts
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="relative flex-1 p-0 overflow-hidden">
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: isFullscreen ? 'calc(100vh - 200px)' : `${height}px` }}
        />
        {sortedCandles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-xs text-slate-400">
            {loading ? 'Loading market candles…' : 'No candle history available for this symbol.'}
          </div>
        )}
      </CardContent>

      <Dialog
        open={indicatorModalOpen}
        onOpenChange={setIndicatorModalOpen}
        title="Kelola Indikator Teknikal & Favorit Indikator"
        description="Seluruh indikator dihitung real-time dari data candle live broker Fortuno Markets. Klik ikon bintang (★) untuk menyematkan indikator ke bar Favorit di atas chart."
      >
        <div className="space-y-4 text-xs">
          <form
            onSubmit={handleAddCustomIndicator}
            className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2.5"
          >
            <div className="font-semibold text-slate-200">
              + Tambah Indikator Kustom (Custom Period)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Tipe Indikator</label>
                <Select
                  aria-label="Tipe Indikator Kustom"
                  value={customKind}
                  onChange={(e) => setCustomKind(e.target.value as IndicatorKind)}
                  className="h-8 text-xs"
                >
                  <option value="SMA">SMA (Simple Moving Average)</option>
                  <option value="EMA">EMA (Exponential Moving Average)</option>
                  <option value="WMA">WMA (Weighted Moving Average)</option>
                  <option value="BB">BB (Bollinger Bands)</option>
                  <option value="DC">Donchian Channel</option>
                  <option value="VWAP">VWAP (Volume Weighted)</option>
                  <option value="RSI">RSI (Relative Strength Index)</option>
                  <option value="MACD">MACD</option>
                  <option value="ATR">ATR (Average True Range)</option>
                  <option value="STOCH">Stochastic Oscillator</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Periode (2 – 500)
                </label>
                <Input
                  type="number"
                  min={2}
                  max={500}
                  value={customPeriod}
                  onChange={(e) => setCustomPeriod(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" size="sm" className="h-8 w-full text-xs">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Tambah &amp; Favoritkan
                </Button>
              </div>
            </div>
          </form>

          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {catalogSpecs.map((spec) => {
              const isActive = activeIndicators.includes(spec.id);
              const isFav = favoriteIndicators.includes(spec.id);
              return (
                <div
                  key={spec.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleFavoriteIndicator(spec.id)}
                      aria-label={`Toggle favorit ${spec.label}`}
                      className="rounded p-1 hover:bg-slate-800"
                      title={isFav ? 'Hapus dari Favorit' : 'Tambahkan ke Favorit'}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                        }`}
                      />
                    </button>
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-slate-100">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: spec.color }}
                        />
                        <span>{spec.label}</span>
                        <Badge variant="outline" className="text-[9px]">
                          {spec.placement === 'overlay' ? 'Chart Overlay' : 'Live Oscillator'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">{spec.description}</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => toggleActiveIndicator(spec.id)}
                    className="h-7 px-3 text-xs"
                  >
                    {isActive ? 'Aktif di Chart' : 'Pasang'}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIndicatorModalOpen(false)}
            >
              Selesai
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
