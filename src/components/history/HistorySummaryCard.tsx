'use client';

import * as React from 'react';
import { Award, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { ClosedPosition, LedgerEntry } from '@/types/api';
import { formatMoney, formatSigned } from '@/utils/formatters';
import { summarizeClosedPositions, summarizeLedger } from '@/utils/tradingCalculations';

export interface HistorySummaryCardProps {
  readonly closedPositions: readonly ClosedPosition[];
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly currency?: string;
}

export function HistorySummaryCard({
  closedPositions,
  ledgerEntries,
  currency = 'USD',
}: HistorySummaryCardProps): React.ReactElement {
  const summary = React.useMemo(
    () => summarizeClosedPositions(closedPositions),
    [closedPositions],
  );
  const ledgerTotals = React.useMemo(() => summarizeLedger(ledgerEntries), [ledgerEntries]);

  const netLedger = Object.values(ledgerTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Closed Trades</span>
            <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-slate-100">
            {summary.totalTrades}
          </p>
          <p className="text-[10px] text-slate-400">
            {summary.wins}W / {summary.losses}L
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Win Rate</span>
            <Award className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-slate-100">
            {summary.winRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400">Success ratio</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Net P&amp;L</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p
            className={`mt-1.5 font-mono text-lg font-bold ${
              summary.totalPnl > 0
                ? 'text-emerald-400'
                : summary.totalPnl < 0
                  ? 'text-rose-400'
                  : 'text-slate-200'
            }`}
          >
            {formatSigned(summary.totalPnl, 2)} {currency}
          </p>
          <p className="text-[10px] text-slate-400">Incl. commission &amp; swap</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avg Winning Trade</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-emerald-400">
            {formatMoney(summary.averageProfit, currency)}
          </p>
          <p className="text-[10px] text-slate-400">Mean positive trade</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avg Losing Trade</span>
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-rose-400">
            {formatMoney(summary.averageLoss, currency)}
          </p>
          <p className="text-[10px] text-slate-400">Mean negative trade</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Ledger Flow</span>
            <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <p
            className={`mt-1.5 font-mono text-lg font-bold ${
              netLedger >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatSigned(netLedger, 2)} {currency}
          </p>
          <p className="text-[10px] text-slate-400">{ledgerEntries.length} ledger ops</p>
        </CardContent>
      </Card>
    </div>
  );
}
