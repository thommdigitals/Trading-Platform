'use client';

import * as React from 'react';
import { Loader2, Play, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CANDLE_INTERVALS } from '@/config/market';
import { useAutomation } from '@/hooks/useAutomation';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import {
  type AutomationStrategy,
  type ParsedStrategy,
  StrategyRiskConfigSchema,
} from '@/types/ai';
import type { CandleInterval } from '@/types/api';

const STRATEGY_TEMPLATES = [
  {
    label: 'RSI Oversold/Overbought Reversal',
    text: 'Buka BUY ketika RSI(14) di bawah 30 dan harga memantul di atas SMA(20). Buka SELL ketika RSI(14) di atas 70 dan harga di bawah SMA(20). Tutup posisi jika profit mencapai 25 pips atau RSI kembali ke 50.',
  },
  {
    label: 'SMA 20/50 Crossover Trend',
    text: 'Buka BUY ketika SMA(20) memotong ke atas SMA(50) dan RSI(14) antara 45 hingga 68. Buka SELL ketika SMA(20) memotong ke bawah SMA(50). Gunakan Stop Loss 20 pips dan Take Profit 40 pips.',
  },
  {
    label: 'Bollinger Band Mean Reversion',
    text: 'Buka BUY saat harga menyentuh Bollinger Band bawah dan RSI(14) < 35. Buka SELL saat harga menyentuh Bollinger Band atas dan RSI(14) > 65. Targetkan middle band (SMA 20).',
  },
] as const;

export function AutomationBuilder(): React.ReactElement {
  const defaultSymbol = useConfigStore((s) => s.defaultSymbol);
  const { symbols } = useSymbols();
  const { parseStrategy, startStrategy, automationStatus } = useAutomation();

  const [rawDescription, setRawDescription] = React.useState<string>(STRATEGY_TEMPLATES[0].text);
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState<ParsedStrategy | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Risk config state
  const [symbol, setSymbol] = React.useState(defaultSymbol);
  const [interval, setInterval] = React.useState<CandleInterval>('M15');
  const [volume, setVolume] = React.useState('0.01');
  const [maxOpenPositions, setMaxOpenPositions] = React.useState('2');
  const [maxDailyLoss, setMaxDailyLoss] = React.useState('100');
  const [maxDrawdownPercent, setMaxDrawdownPercent] = React.useState('10');
  const [activeHoursStart, setActiveHoursStart] = React.useState('00:00');
  const [activeHoursEnd, setActiveHoursEnd] = React.useState('23:59');

  const handleParse = async (): Promise<void> => {
    if (!rawDescription.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const res = await parseStrategy(rawDescription.trim());
      setParsed(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse strategy');
    } finally {
      setParsing(false);
    }
  };

  const handleActivate = (): void => {
    if (!parsed) return;
    setError(null);

    const riskCheck = StrategyRiskConfigSchema.safeParse({
      symbol,
      interval,
      volume: Number(volume),
      maxOpenPositions: Number(maxOpenPositions),
      maxDailyLoss: Number(maxDailyLoss),
      maxDrawdownPercent: Number(maxDrawdownPercent),
      activeHoursStart,
      activeHoursEnd,
    });

    if (!riskCheck.success) {
      setError(riskCheck.error.issues[0]?.message ?? 'Invalid risk configuration');
      return;
    }

    const strategy: AutomationStrategy = {
      id: crypto.randomUUID(),
      rawDescription,
      createdAt: Date.now(),
      ...parsed,
      ...riskCheck.data,
    };

    startStrategy(strategy);
  };

  const isRunning = automationStatus === 'running' || automationStatus === 'paused';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <CardTitle className="text-sm font-semibold">
              AI Natural Language Strategy Builder
            </CardTitle>
          </div>
          <Badge variant="outline">4-Step Guarded Setup</Badge>
        </div>
        <p className="text-[11px] text-slate-400">
          Describe your trading rules in plain Indonesian or English. AI translates them into
          structured rules enforced by hard risk guardrails.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pt-0 text-xs">
        {/* Step 1: Natural Language Input */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-semibold text-slate-200">
              1. Describe Your Strategy Rules
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STRATEGY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setRawDescription(tpl.text)}
                  className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300 hover:border-blue-500/40 hover:text-white"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            aria-label="Strategy description"
            rows={3}
            value={rawDescription}
            onChange={(e) => setRawDescription(e.target.value)}
            placeholder="Contoh: Buka BUY EURUSD saat RSI(14) < 30 dan harga di atas SMA(50)…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
          />

          <Button
            size="sm"
            variant="default"
            disabled={parsing || !rawDescription.trim()}
            onClick={() => void handleParse()}
          >
            {parsing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Parsing Strategy with AI…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Parse Strategy with AI
              </>
            )}
          </Button>
        </div>

        {/* Step 2: Editable Parsed Conditions */}
        {parsed && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                2. Review &amp; Customize AI-Extracted Conditions
              </span>
              <Badge variant="success">Parsed</Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Strategy Name</label>
                <Input
                  aria-label="Strategy Name"
                  value={parsed.name}
                  onChange={(e) => setParsed({ ...parsed, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Summary</label>
                <Input
                  aria-label="Strategy Summary"
                  value={parsed.summary}
                  onChange={(e) => setParsed({ ...parsed, summary: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-emerald-400">
                    Entry Conditions ({parsed.entryConditions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParsed({
                        ...parsed,
                        entryConditions: [...parsed.entryConditions, 'New entry condition'],
                      })
                    }
                    className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {parsed.entryConditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={cond}
                      onChange={(e) => {
                        const next = [...parsed.entryConditions];
                        next[idx] = e.target.value;
                        setParsed({ ...parsed, entryConditions: next });
                      }}
                      className="h-7 text-xs"
                    />
                    {parsed.entryConditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setParsed({
                            ...parsed,
                            entryConditions: parsed.entryConditions.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1 text-slate-400 hover:text-rose-400"
                        aria-label="Remove entry condition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-amber-400">
                    Exit Conditions ({parsed.exitConditions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParsed({
                        ...parsed,
                        exitConditions: [...parsed.exitConditions, 'New exit condition'],
                      })
                    }
                    className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {parsed.exitConditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={cond}
                      onChange={(e) => {
                        const next = [...parsed.exitConditions];
                        next[idx] = e.target.value;
                        setParsed({ ...parsed, exitConditions: next });
                      }}
                      className="h-7 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setParsed({
                          ...parsed,
                          exitConditions: parsed.exitConditions.filter((_, i) => i !== idx),
                        })
                      }
                      className="p-1 text-slate-400 hover:text-rose-400"
                      aria-label="Remove exit condition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Risk Guardrails Configuration */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              3. Mandatory Risk Guardrails &amp; Execution Schedule
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Instrument</label>
              <Select
                aria-label="Automation symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="h-8 text-xs py-0.5 px-2"
              >
                {symbols.length > 0 ? (
                  symbols.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.alias || s.symbol}
                    </option>
                  ))
                ) : (
                  <option value={symbol}>{symbol}</option>
                )}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Evaluation Interval</label>
              <Select
                aria-label="Automation interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value as CandleInterval)}
                className="h-8 font-mono text-xs py-0.5 px-2"
              >
                {CANDLE_INTERVALS.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Lot Size per Trade</label>
              <Input
                aria-label="Automation lot size"
                type="number"
                step="0.01"
                min="0.01"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Max Open Positions</label>
              <Input
                aria-label="Max Open Positions"
                type="number"
                min="1"
                max="50"
                value={maxOpenPositions}
                onChange={(e) => setMaxOpenPositions(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Max Daily Loss (USD)</label>
              <Input
                aria-label="Max Daily Loss"
                type="number"
                min="1"
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Max Drawdown (%)</label>
              <Input
                aria-label="Max Drawdown Percent"
                type="number"
                min="0.5"
                max="95"
                step="0.5"
                value={maxDrawdownPercent}
                onChange={(e) => setMaxDrawdownPercent(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Active Start (UTC)</label>
              <Input
                aria-label="Active Hours Start"
                value={activeHoursStart}
                onChange={(e) => setActiveHoursStart(e.target.value)}
                placeholder="00:00"
                className="h-8 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Active End (UTC)</label>
              <Input
                aria-label="Active Hours End"
                value={activeHoursEnd}
                onChange={(e) => setActiveHoursEnd(e.target.value)}
                placeholder="23:59"
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Step 4: Activate */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-400">
            4. Engine will evaluate on each {interval} cycle and halt automatically if any risk limit is breached.
          </span>
          <Button
            variant="buy"
            disabled={!parsed || isRunning}
            onClick={handleActivate}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {isRunning ? 'Strategy Currently Active' : 'Activate AI Automation'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
