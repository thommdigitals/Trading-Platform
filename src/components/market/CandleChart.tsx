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
import { Activity, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useCandles } from '@/hooks/useCandles';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { Candle, CandleInterval } from '@/types/api';
import { formatPrice } from '@/utils/formatters';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  lastValue,
} from '@/utils/indicators';

import { IntervalSelector } from './IntervalSelector';

export interface CandleChartProps {
  readonly height?: number;
  readonly compact?: boolean;
}

export function CandleChart({
  height = 420,
  compact = false,
}: CandleChartProps): React.ReactElement {
  const selectedSymbol = useConfigStore((s) => s.defaultSymbol);
  const setSelectedSymbol = useConfigStore((s) => s.setDefaultSymbol);
  const selectedInterval = useConfigStore((s) => s.defaultInterval);
  const setSelectedInterval = useConfigStore((s) => s.setDefaultInterval);
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

  const [showSma20, setShowSma20] = React.useState(true);
  const [showSma50, setShowSma50] = React.useState(false);
  const [showEma20, setShowEma20] = React.useState(false);
  const [showBB, setShowBB] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [hoveredCandle, setHoveredCandle] = React.useState<Candle | null>(null);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const candleSeriesRef = React.useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = React.useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20SeriesRef = React.useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = React.useRef<ISeriesApi<'Line'> | null>(null);
  const ema20SeriesRef = React.useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = React.useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = React.useRef<ISeriesApi<'Line'> | null>(null);
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

  const latestRsi = React.useMemo(() => {
    return lastValue(calculateRSI(sortedCandles, 14));
  }, [sortedCandles]);

  // Initialize chart instance
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isLight = theme === 'light';
    const chart = createChart(container, {
      width: container.clientWidth || 640,
      height: isFullscreen ? Math.max(window.innerHeight - 160, 480) : height,
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

    const sma20Series = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const sma50Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20SeriesRef.current = sma20Series;
    sma50SeriesRef.current = sma50Series;
    ema20SeriesRef.current = ema20Series;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbLowerSeriesRef.current = bbLowerSeries;

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
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, [theme, height, isFullscreen, precision]);

  // Populate candle & indicator series data
  React.useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const sma20Series = sma20SeriesRef.current;
    const sma50Series = sma50SeriesRef.current;
    const ema20Series = ema20SeriesRef.current;
    const bbUpperSeries = bbUpperSeriesRef.current;
    const bbLowerSeries = bbLowerSeriesRef.current;

    if (!candleSeries || !volumeSeries || sortedCandles.length === 0) return;

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

    if (sma20Series) {
      if (showSma20) {
        const vals = calculateSMA(sortedCandles, 20);
        sma20Series.setData(
          vals
            .map((v, idx) =>
              v !== null && sortedCandles[idx]
                ? {
                    time: Math.floor(sortedCandles[idx].timestamp / 1000) as UTCTimestamp,
                    value: v,
                  }
                : null,
            )
            .filter((item): item is { time: UTCTimestamp; value: number } => item !== null),
        );
      } else {
        sma20Series.setData([]);
      }
    }

    if (sma50Series) {
      if (showSma50) {
        const vals = calculateSMA(sortedCandles, 50);
        sma50Series.setData(
          vals
            .map((v, idx) =>
              v !== null && sortedCandles[idx]
                ? {
                    time: Math.floor(sortedCandles[idx].timestamp / 1000) as UTCTimestamp,
                    value: v,
                  }
                : null,
            )
            .filter((item): item is { time: UTCTimestamp; value: number } => item !== null),
        );
      } else {
        sma50Series.setData([]);
      }
    }

    if (ema20Series) {
      if (showEma20) {
        const vals = calculateEMA(sortedCandles, 20);
        ema20Series.setData(
          vals
            .map((v, idx) =>
              v !== null && sortedCandles[idx]
                ? {
                    time: Math.floor(sortedCandles[idx].timestamp / 1000) as UTCTimestamp,
                    value: v,
                  }
                : null,
            )
            .filter((item): item is { time: UTCTimestamp; value: number } => item !== null),
        );
      } else {
        ema20Series.setData([]);
      }
    }

    if (bbUpperSeries && bbLowerSeries) {
      if (showBB) {
        const bb = calculateBollingerBands(sortedCandles, 20, 2);
        bbUpperSeries.setData(
          bb.upper
            .map((v, idx) =>
              v !== null && sortedCandles[idx]
                ? {
                    time: Math.floor(sortedCandles[idx].timestamp / 1000) as UTCTimestamp,
                    value: v,
                  }
                : null,
            )
            .filter((item): item is { time: UTCTimestamp; value: number } => item !== null),
        );
        bbLowerSeries.setData(
          bb.lower
            .map((v, idx) =>
              v !== null && sortedCandles[idx]
                ? {
                    time: Math.floor(sortedCandles[idx].timestamp / 1000) as UTCTimestamp,
                    value: v,
                  }
                : null,
            )
            .filter((item): item is { time: UTCTimestamp; value: number } => item !== null),
        );
      } else {
        bbUpperSeries.setData([]);
        bbLowerSeries.setData([]);
      }
    }

    setHoveredCandle(sortedCandles[sortedCandles.length - 1] ?? null);
  }, [sortedCandles, showSma20, showSma50, showEma20, showBB]);

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

  const activeBar = hoveredCandle ?? sortedCandles[sortedCandles.length - 1] ?? null;

  return (
    <Card
      className={
        isFullscreen
          ? 'fixed inset-3 z-50 flex flex-col bg-slate-950 border-slate-800 shadow-2xl'
          : 'flex flex-col'
      }
    >
      <CardHeader className="flex flex-col gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
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
            {!compact && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-1">
                <button
                  type="button"
                  onClick={() => setShowSma20((v) => !v)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    showSma20
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SMA 20
                </button>
                <button
                  type="button"
                  onClick={() => setShowSma50((v) => !v)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    showSma50
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SMA 50
                </button>
                <button
                  type="button"
                  onClick={() => setShowEma20((v) => !v)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    showEma20
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  EMA 20
                </button>
                <button
                  type="button"
                  onClick={() => setShowBB((v) => !v)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    showBB
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  BB(20,2)
                </button>
              </div>
            )}

            {latestRsi !== null && (
              <Badge
                variant={latestRsi >= 70 ? 'danger' : latestRsi <= 30 ? 'success' : 'outline'}
                className="font-mono text-[10px]"
              >
                <Activity className="mr-1 h-3 w-3" />
                RSI(14): {latestRsi.toFixed(1)}
              </Badge>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={() => void refresh()}
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

        {activeBar && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
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
        )}
      </CardHeader>

      <CardContent className="relative flex-1 p-0 overflow-hidden">
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: isFullscreen ? 'calc(100vh - 170px)' : `${height}px` }}
        />
        {sortedCandles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-xs text-slate-400">
            {loading ? 'Loading market candles…' : 'No candle history available for this symbol.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
