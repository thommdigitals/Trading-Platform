'use client';

import * as React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

import { ClosedPositionsTable } from '@/components/history/ClosedPositionsTable';
import { HistorySummaryCard } from '@/components/history/HistorySummaryCard';
import { LedgerTable } from '@/components/history/LedgerTable';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showError } from '@/components/ui/toast';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { ClosedPosition, LedgerEntry } from '@/types/api';

const PRESETS = [
  { label: '24 Hours', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
] as const;

export default function HistoryPage(): React.ReactElement {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const account = useTradingStore((s) => s.account);
  const currency = account?.currency ?? 'USD';

  const [fromDate, setFromDate] = React.useState<string>(() => {
    const d = new Date(Date.now() - 7 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = React.useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [closedPositions, setClosedPositions] = React.useState<ClosedPosition[]>([]);
  const [ledgerEntries, setLedgerEntries] = React.useState<LedgerEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'closed' | 'ledger'>('closed');

  const fetchHistory = React.useCallback(async () => {
    if (!apiToken && !demoMode) return;
    const fromMs = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    const toMs = new Date(`${toDate}T23:59:59.999Z`).getTime();
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return;

    setLoading(true);
    try {
      const [positions, ledgers] = await Promise.all([
        fortunoApi.getClosedPositionsAll({ from: fromMs, to: toMs }),
        fortunoApi.getLedgersAll({ from: fromMs, to: toMs }),
      ]);
      setClosedPositions(positions);
      setLedgerEntries(ledgers);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, apiToken, demoMode]);

  React.useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const applyPreset = (days: number): void => {
    const now = new Date();
    const start = new Date(now.getTime() - days * 86_400_000);
    setFromDate(start.toISOString().slice(0, 10));
    setToDate(now.toISOString().slice(0, 10));
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <div>
              <h1 className="text-sm font-semibold text-slate-100">
                Trading &amp; Financial Ledger History
              </h1>
              <p className="text-[11px] text-slate-400">
                Analyze historical trade performance and export audited CSV statements
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="rounded-md border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300 hover:border-blue-500/40 hover:text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <Input
                aria-label="History start date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <span className="text-slate-500">to</span>
              <Input
                aria-label="History end date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>

            <Button
              size="sm"
              variant="default"
              disabled={loading}
              onClick={() => void fetchHistory()}
              className="h-8 text-xs"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Load
            </Button>
          </div>
        </div>

        <HistorySummaryCard
          closedPositions={closedPositions}
          ledgerEntries={ledgerEntries}
          currency={currency}
        />

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('closed')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'closed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Closed Positions ({closedPositions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'ledger'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Ledger Operations ({ledgerEntries.length})
            </button>
          </div>

          {activeTab === 'closed' ? (
            <ClosedPositionsTable positions={closedPositions} currency={currency} />
          ) : (
            <LedgerTable entries={ledgerEntries} currency={currency} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

