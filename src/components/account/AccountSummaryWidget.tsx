'use client';

import { Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useTradingStore } from '@/store/tradingStore';
import {
  formatMoney,
  formatPercent,
  formatSigned,
  pnlColorClass,
} from '@/utils/formatters';
import { cn } from '@/utils/cn';

const METRIC_INFO = {
  balance: 'Total dana di akun (belum termasuk floating P&L posisi terbuka).',
  equity: 'Balance ditambah Floating P&L (nilai akun bersih saat ini).',
  margin: 'Dana jaminan yang sedang digunakan oleh posisi terbuka.',
  freeMargin: 'Dana bebas yang tersedia untuk membuka posisi baru (Equity - Margin).',
  marginLevel: 'Rasio kesehatan akun (Equity / Margin × 100%). Di atas 100% aman.',
  floatingProfit: 'Total keuntungan/kerugian belum terealisasi dari semua posisi terbuka.',
} as const;

export function AccountSummaryWidget() {
  const account = useTradingStore((s) => s.account);
  const summary = useTradingStore((s) => s.accountSummary);
  const loading = useTradingStore((s) => s.loading.account);

  if (loading && !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const currency = account?.currency ?? 'USD';
  const precision = account?.currencyPrecision ?? 2;
  const floating = summary?.floatingProfit ?? 0;

  const items = [
    {
      label: 'Balance',
      value: formatMoney(summary?.balance, currency, precision),
      tooltip: METRIC_INFO.balance,
      color: '',
    },
    {
      label: 'Equity',
      value: formatMoney(summary?.equity, currency, precision),
      tooltip: METRIC_INFO.equity,
      color: '',
    },
    {
      label: 'Margin Used',
      value: formatMoney(summary?.margin, currency, precision),
      tooltip: METRIC_INFO.margin,
      color: '',
    },
    {
      label: 'Free Margin',
      value: formatMoney(summary?.freeMargin, currency, precision),
      tooltip: METRIC_INFO.freeMargin,
      color: '',
    },
    {
      label: 'Margin Level',
      value: summary?.marginLevel !== null && summary?.marginLevel !== undefined
        ? formatPercent(summary.marginLevel, 2)
        : '—',
      tooltip: METRIC_INFO.marginLevel,
      color:
        summary?.marginLevel && summary.marginLevel < 120
          ? 'text-amber-500'
          : '',
    },
    {
      label: 'Floating P&L',
      value: summary
        ? `${formatSigned(floating, precision)} ${currency}`
        : '—',
      tooltip: METRIC_INFO.floatingProfit,
      color: pnlColorClass(floating),
    },
  ];

  return (
    <div
      aria-label="Account Summary"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {items.map((item) => (
        <Card key={item.label} className="p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{item.label}</span>
            <Tooltip content={item.tooltip}>
              <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div
            className={cn(
              'mt-1.5 text-sm font-bold tracking-tight sm:text-base',
              item.color || 'text-slate-900 dark:text-slate-100',
            )}
          >
            {item.value}
          </div>
        </Card>
      ))}
    </div>
  );
}

