'use client';

import { Card } from '@/components/ui/card';
import { useTradingStore } from '@/store/tradingStore';
import { formatMoney, formatSigned, pnlColorClass } from '@/utils/formatters';
import { summarizePositions } from '@/utils/tradingCalculations';
import { cn } from '@/utils/cn';

export function PortfolioOverview() {
  const account = useTradingStore((s) => s.account);
  const positions = useTradingStore((s) => s.positions);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);

  const summary = summarizePositions(positions);
  const currency = account?.currency ?? 'USD';
  const precision = account?.currencyPrecision ?? 2;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-5">
        <div>
          <span className="text-slate-500 dark:text-slate-400">Open Positions: </span>
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {summary.count}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Total Volume: </span>
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {summary.totalVolume.toFixed(2)} lot
          </strong>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Pending Orders: </span>
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {pendingOrders.length}
          </strong>
        </div>
      </div>
      <div>
        <span className="text-slate-500 dark:text-slate-400">Net Open P&amp;L: </span>
        <strong className={cn('font-bold', pnlColorClass(summary.totalProfit))}>
          {formatSigned(summary.totalProfit, precision)} {currency}
        </strong>
        {account && (
          <span className="ml-3 text-slate-400">
            ({formatMoney(summary.totalProfit, currency, precision)})
          </span>
        )}
      </div>
    </Card>
  );
}
